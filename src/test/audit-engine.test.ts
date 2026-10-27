import { describe, it, expect } from "vitest";
import { runAudit, dayOf, valueAtRisk, type StoneRow, type WiRow } from "@/lib/audit/engine";

let seq = 1;
const stone = (o: Partial<StoneRow> = {}): StoneRow => {
  const n = seq++;
  return { os: `OS${n}`, os_key: `OS${n}`, stonecode: `SC${n}`, cidade: "Patos", produto: "STONE", grupo_servico: "INSTALAÇÃO",
    data_abertura: "2026-09-01T00:00:00-03:00", data_limite_atendimento: "2026-09-10T00:00:00-03:00", data_atendimento: "2026-09-05T00:00:00-03:00",
    distancia_km: 5, nome_tecnico: "Ana", status: "BAIXADA", motivo_cancelamento: null, visitas: 1, abono: "0", raio: "R1",
    dias_ate_atendimento: 4, multa: 0, valor_base_os: 30, valor_pago: 30, status_pagamento: "Pago: 100% (OS de maior valor na visita)", was_realigned: false, ...o };
};
const wi = (s: StoneRow, o: Partial<WiRow> = {}): WiRow => ({ chamado: s.os, chamado_key: s.os_key, status: s.status, contratante: "STONE PAGAMENTOS",
  grupo_servico: s.grupo_servico, tecnico: s.nome_tecnico, cidade: s.cidade, numero_visitas: s.visitas, data_atendimento: s.data_atendimento, ...o });
const run = (rows: StoneRow[], extra: Partial<Parameters<typeof runAudit>[0]> = {}) =>
  runAudit({ stone: rows, workinfinity: rows.map((r) => wi(r)), triagem: [], consolidado: null, ...extra });
const titles = (r: ReturnType<typeof runAudit>) => r.findings.map((f) => f.title);

describe("Motor de auditoria", () => {
  it("não gera achados quando as bases batem", () => {
    const a = stone();
    expect(run([a]).findings).toEqual([]);
  });
  it("converte datas para o dia em São Paulo (UTC-3)", () => {
    expect(dayOf("2026-09-18T01:30:00.000Z")).toBe("2026-09-17");
    expect(dayOf(null)).toBeNull();
  });
  it("R1: cancelado sem visita e sem técnico é info e já fica aceito; outros casos são alta gravidade", () => {
    const a = stone();
    const ok: WiRow = { chamado: "X1", chamado_key: "X1", status: "CANCELADA", contratante: "TON", grupo_servico: "INSTALAÇÃO", tecnico: null, cidade: "Patos", numero_visitas: 0, data_atendimento: null };
    const bad: WiRow = { ...ok, chamado: "X2", chamado_key: "X2", status: "BAIXADA", tecnico: "Ana", numero_visitas: 1 };
    const r = runAudit({ stone: [a], workinfinity: [wi(a), ok, bad], triagem: [], consolidado: null });
    const f1 = r.findings.find((f) => f.os === "X1");
    const f2 = r.findings.find((f) => f.os === "X2");
    expect(f1).toMatchObject({ severity: "info", auto_review: "aceito", title: "Cancelado sem visita (ok)" });
    expect(f2).toMatchObject({ severity: "high", title: "Possível atendimento não apurado" });
    expect(r.counts.soWorkinfinity).toBe(2);
  });
  it("R2: OS só na Stone gera alerta", () => {
    const a = stone();
    const r = runAudit({ stone: [a], workinfinity: [], triagem: [], consolidado: null });
    expect(titles(r)).toContain("OS só na apuração da Stone");
  });
  it("R3: status diferente e visitas diferentes (ignora linhas realinhadas nas visitas)", () => {
    const a = stone({ status: "(Tratamento) Sem Retorno", visitas: 1 });
    const b = stone({ visitas: 1 });
    const c = stone({ visitas: null, was_realigned: true, status: "(Tratamento) Sem Retorno" });
    const r = runAudit({ stone: [a, b, c], workinfinity: [wi(a, { status: "CANCELADA" }), wi(b, { numero_visitas: 2 }), wi(c, { status: "CANCELADA", numero_visitas: 2 })], triagem: [], consolidado: null });
    expect(titles(r).filter((t) => t === "Status diferente entre as bases")).toHaveLength(2);
    expect(titles(r).filter((t) => t === "Número de visitas diferente")).toHaveLength(1);
  });
  it("conciliação usa Stone + Ton + Bobina e acumula sem arredondar por linha", () => {
    const p40 = () => stone({ valor_base_os: 33.76, valor_pago: 13.504, status_pagamento: "Pago: 40% (OS adicional na mesma visita)" });
    const r = run([p40(), p40(), p40()], { consolidado: { stone: 40.51, ton: 0, bobina: 0, triagem: null } });
    expect(r.reconciliation).toMatchObject({ base: 101.28, pago: 40.51, retido: 60.77, consolidadoPago: 40.51, validationDiff: 0 });
    expect(r.decomposition.p40).toEqual({ n: 3, valor: 60.77 });
  });
  it("R4: baixa tardia – aberta antes da visita anterior é consistente (low)", () => {
    const prev = stone({ stonecode: "SCX", data_atendimento: "2026-09-10T00:00:00-03:00" });
    const late = stone({ stonecode: "SCX", data_abertura: "2026-09-02T00:00:00-03:00", data_atendimento: "2026-09-20T00:00:00-03:00", valor_pago: 0, status_pagamento: "Auditoria: Baixa tardia após visita anterior" });
    const f = run([prev, late]).findings.find((x) => x.os === late.os)!;
    expect(f).toMatchObject({ rule_key: "payment_difference", severity: "low", diferenca: 30 });
  });
  it("R4: baixa tardia – aberta depois da visita anterior é retenção indevida (high)", () => {
    const prev = stone({ stonecode: "SCY", data_atendimento: "2026-09-10T00:00:00-03:00" });
    const late = stone({ stonecode: "SCY", data_abertura: "2026-09-12T00:00:00-03:00", data_atendimento: "2026-09-20T00:00:00-03:00", valor_pago: 0, status_pagamento: "Auditoria: Baixa tardia após visita anterior" });
    expect(run([prev, late]).findings.find((x) => x.os === late.os)!.severity).toBe("high");
  });
  it("R4: baixa tardia – mesmo dia sem horário pede conferência (medium); com horário decide", () => {
    const mk = (abertura: string) => {
      const prev = stone({ stonecode: "SCZ", data_atendimento: "2026-09-10T10:00:00-03:00" });
      const late = stone({ stonecode: "SCZ", data_abertura: abertura, data_atendimento: "2026-09-20T00:00:00-03:00", valor_pago: 0, status_pagamento: "Auditoria: Baixa tardia após visita anterior" });
      return run([prev, late]).findings.find((x) => x.os === late.os)!;
    };
    expect(mk("2026-09-10T00:00:00-03:00").severity).toBe("medium");
    expect(mk("2026-09-10T14:00:00-03:00").severity).toBe("high");
    expect(mk("2026-09-10T08:00:00-03:00").severity).toBe("low");
  });
  it("R4: baixa tardia sem visita anterior ao mesmo cliente é alta gravidade", () => {
    const late = stone({ valor_pago: 0, status_pagamento: "Auditoria: Baixa tardia após visita anterior" });
    expect(run([late]).findings[0]).toMatchObject({ severity: "high" });
  });
  it("R5: grupo com duas OS a 100% e 40% mal calculado", () => {
    const a = stone({ stonecode: "G1" }), b = stone({ stonecode: "G1" });
    expect(titles(run([a, b]))).toContain("Mais de uma OS a 100% na mesma visita");
    const c = stone({ stonecode: "G2" });
    const d = stone({ stonecode: "G2", valor_pago: 10, status_pagamento: "Pago: 40% (OS adicional na mesma visita)" });
    expect(titles(run([c, d]))).toContain("40% calculado incorretamente");
  });
  it("R6: pagamento negativo, base zerado com visita e multa com abono", () => {
    const neg = stone({ valor_base_os: 33.76, multa: 46.15, valor_pago: -12.39 });
    const zero = stone({ valor_base_os: 0, valor_pago: 0, status: "CANCELADA", visitas: 1 });
    const ref = [stone(), stone(), stone()];
    const abn = stone({ multa: 5, abono: "1", valor_pago: 25 });
    const r = run([neg, zero, abn, ...ref]);
    expect(titles(r)).toEqual(expect.arrayContaining(["Valor pago negativo", "Valor base zerado em OS com visita", "Multa aplicada em OS com abono"]));
    expect(r.findings.find((f) => f.title === "Valor base zerado em OS com visita")!.diferenca).toBe(30);
  });
  it("R7: usa a tabela de preços manual quando existe", () => {
    const a = stone({ valor_base_os: 25, valor_pago: 25 });
    const r = run([a], { prices: [{ produto: "STONE", grupo_servico: "INSTALAÇÃO", raio: "R1", expected_valor_base: 30 }] });
    expect(r.findings.find((f) => f.rule_key === "price_table_deviation")).toMatchObject({ severity: "medium", diferenca: 5 });
  });
  it("R8: distância improvável e raio incoerente", () => {
    const r = run([stone({ raio: "R4", distancia_km: 19540 }), stone({ raio: "R1", distancia_km: 60 }), stone({ raio: "R2", distancia_km: 30 })]);
    expect(titles(r)).toEqual(expect.arrayContaining(["Distância improvável", "Raio incoerente com a distância"]));
    expect(r.findings.filter((f) => f.rule_key === "radius_distance_mismatch")).toHaveLength(2);
  });
  it("R9: triagem – R$ 5 por GOOD e soma contra o Consolidado", () => {
    const r = run([stone()], { triagem: [{ serial: "A", status_triagem: "GOOD", valor_triagem: 5 }, { serial: "B", status_triagem: "GOOD", valor_triagem: 4 }], consolidado: { stone: 30, ton: 0, bobina: 0, triagem: 20 } });
    expect(titles(r)).toEqual(expect.arrayContaining(["Triagem fora do padrão de R$ 5,00 por GOOD", "Soma da triagem diferente do Consolidado"]));
  });
  it("respeita regras desligadas", () => {
    const r = run([stone({ raio: "R4", distancia_km: 19540 })], { enabledRules: ["only_in_stone"] });
    expect(r.findings).toEqual([]);
  });
  it("resumos: técnico das linhas realinhadas vem do Workinfinity; prazos e dias", () => {
    const a = stone({ was_realigned: true, nome_tecnico: "CANCELADA", data_atendimento: "2026-09-12T00:00:00-03:00", data_limite_atendimento: "2026-09-10T00:00:00-03:00", multa: 0 });
    const r = runAudit({ stone: [a], workinfinity: [wi(a, { tecnico: "Kelvys" })], triagem: [], consolidado: null });
    expect(r.byTechnician[0]!.key).toBe("Kelvys");
    expect(r.late[0]).toMatchObject({ diasAtraso: 2 });
    expect(r.daily).toEqual([{ dia: "2026-09-12", n: 1, pago: 30 }]);
  });
  it("valor em risco soma só achados pendentes e a contestar", () => {
    expect(valueAtRisk([{ diferenca: 10, review_status: "pendente" }, { diferenca: 5, review_status: "contestar" }, { diferenca: 99, review_status: "aceito" }])).toBe(15);
  });
});
