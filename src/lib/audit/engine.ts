/**
 * Motor de auditoria SCL Audit (funções puras, sem Supabase e sem interface).
 * Entrada: registros já tratados (sem PII) de um período; saída: achados e resumos.
 * Mantenha apenas sintaxe "apagável" (sem enum), para rodar também com node --experimental-strip-types.
 */
export type Severity = "info" | "low" | "medium" | "high";
export type RuleKey =
  | "only_in_workinfinity" | "only_in_stone" | "status_or_visits_mismatch" | "payment_difference"
  | "visit_rule_40pct" | "payment_anomalies" | "price_table_deviation" | "radius_distance_mismatch"
  | "triage_payment_mismatch";

export interface StoneRow {
  os: string; os_key: string; stonecode: string | null; cidade: string | null; produto: string | null;
  grupo_servico: string | null; data_abertura: string | null; data_limite_atendimento: string | null;
  data_atendimento: string | null; distancia_km: number | null; nome_tecnico: string | null;
  status: string | null; motivo_cancelamento: string | null; visitas: number | null; abono: string | null;
  raio: string | null; dias_ate_atendimento: number | null; multa: number | null; valor_base_os: number | null;
  valor_pago: number | null; status_pagamento: string | null; was_realigned: boolean;
}
export interface WiRow {
  chamado: string; chamado_key: string; status: string | null; contratante: string | null;
  grupo_servico: string | null; tecnico: string | null; cidade: string | null;
  numero_visitas: number | null; data_atendimento: string | null;
}
export interface TriagemRow { serial: string | null; status_triagem: string | null; valor_triagem: number | null }
export interface PriceEntry { produto: string; grupo_servico: string; raio: string; expected_valor_base: number }
export interface Consolidado { stone: number | null; ton: number | null; bobina: number | null; triagem: number | null }
export interface AuditInput {
  stone: StoneRow[]; workinfinity: WiRow[]; triagem: TriagemRow[];
  consolidado: Consolidado | null; prices?: PriceEntry[]; enabledRules?: RuleKey[];
}
export interface Finding {
  rule_key: RuleKey; os: string | null; stonecode: string | null; grupo_servico: string | null;
  tecnico: string | null; cidade: string | null; data_atendimento: string | null;
  valor_base_os: number | null; valor_pago: number | null; diferenca: number;
  severity: Severity; title: string; detail: string; auto_review: "aceito" | null;
}
export interface Group { key: string; n: number; baixadas: number; naoBaixadas: number; base: number; pago: number; retido: number; tardia: number; prazoMedio: number | null }
export interface AuditResult {
  findings: Finding[];
  reconciliation: { base: number; pago: number; retido: number; consolidadoPago: number | null; validationDiff: number | null };
  decomposition: { p40: { n: number; valor: number }; tardia: { n: number; valor: number }; multa: { n: number; valor: number }; outros: { n: number; valor: number } };
  byTechnician: Group[]; byService: Group[];
  byCancelReason: { motivo: string; n: number; visitas: number; base: number; pago: number }[];
  late: { os: string; tecnico: string | null; limite: string; atendida: string; diasAtraso: number; multa: number; abono: boolean; pago: number }[];
  daily: { dia: string; n: number; pago: number }[];
  counts: { workinfinity: number; stone: number; baixadas: number; naoBaixadas: number; soWorkinfinity: number; soStone: number };
}

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const z = (v: number | null | undefined) => v ?? 0;
const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const SP_OFFSET_MS = 3 * 3600 * 1000; // America/Sao_Paulo (UTC-3, sem horário de verão)
export const dayOf = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t - SP_OFFSET_MS).toISOString().slice(0, 10);
};
const hasTime = (iso: string | null | undefined) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && (t - SP_OFFSET_MS) % 86400000 !== 0;
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const payCat = (s: string | null) => {
  const t = norm(s);
  return /tardia/.test(t) ? "tardia" : /40\s*%/.test(t) ? "p40" : /100\s*%/.test(t) ? "p100" : "outro";
};
const hasAbono = (v: string | null) => v != null && (/^(sim|s|true|x)$/i.test(v.trim()) || Number(v) > 0);
const isGood = (s: string | null) => /good/i.test(s ?? "");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const rawMode = (xs: number[]) => {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
};
const RADIUS_BANDS: Record<string, [number, number]> = { R1: [0, 19], R2: [19, 51], R3: [51, 100], R4: [100, Infinity] };

export function runAudit(input: AuditInput): AuditResult {
  const enabled = new Set<RuleKey>(input.enabledRules ?? [
    "only_in_workinfinity", "only_in_stone", "status_or_visits_mismatch", "payment_difference", "visit_rule_40pct",
    "payment_anomalies", "price_table_deviation", "radius_distance_mismatch", "triage_payment_mismatch"]);
  const { stone, workinfinity: wi, triagem } = input;
  const findings: Finding[] = [];
  const add = (f: Partial<Finding> & Pick<Finding, "rule_key" | "severity" | "title">) => {
    if (!enabled.has(f.rule_key)) return;
    findings.push({
      os: null, stonecode: null, grupo_servico: null, tecnico: null, cidade: null, data_atendimento: null,
      valor_base_os: null, valor_pago: null, diferenca: 0, detail: "", auto_review: null, ...f });
  };
  const wiMap = new Map(wi.map((w) => [w.chamado_key, w]));
  const stMap = new Map(stone.map((s) => [s.os_key, s]));
  const tec = (s: StoneRow) => (s.was_realigned ? wiMap.get(s.os_key)?.tecnico : s.nome_tecnico) ?? null;
  const base = (s: StoneRow) => z(s.valor_base_os);
  const pago = (s: StoneRow) => z(s.valor_pago);
  const common = (s: StoneRow) => ({
    os: s.os, stonecode: s.stonecode, grupo_servico: s.grupo_servico, tecnico: tec(s), cidade: s.cidade,
    data_atendimento: s.data_atendimento, valor_base_os: s.valor_base_os, valor_pago: s.valor_pago });

  // R1 / R2 — só em uma das bases
  const onlyWi = wi.filter((w) => !stMap.has(w.chamado_key));
  for (const w of onlyWi) {
    const ok = norm(w.status) === "cancelada" && z(w.numero_visitas) === 0 && !w.tecnico;
    add({ rule_key: "only_in_workinfinity", severity: ok ? "info" : "high", auto_review: ok ? "aceito" : null,
      os: w.chamado, grupo_servico: w.grupo_servico, tecnico: w.tecnico, cidade: w.cidade, data_atendimento: w.data_atendimento,
      title: ok ? "Cancelado sem visita (ok)" : "Possível atendimento não apurado",
      detail: `Chamado só no Workinfinity (${w.contratante ?? "—"}, status ${w.status ?? "—"}, ${z(w.numero_visitas)} visita(s)).` });
  }
  const onlyStone = stone.filter((s) => !wiMap.has(s.os_key));
  for (const s of onlyStone)
    add({ rule_key: "only_in_stone", severity: "medium", ...common(s), title: "OS só na apuração da Stone",
      detail: "A OS foi apurada, mas não consta no relatório do Workinfinity." });

  // R3 — status e visitas
  for (const s of stone) {
    const w = wiMap.get(s.os_key);
    if (!w) continue;
    if (norm(w.status) !== norm(s.status)) {
      const lost = pago(s) === 0 && z(w.numero_visitas) > 0;
      add({ rule_key: "status_or_visits_mismatch", severity: lost ? "medium" : "low", ...common(s),
        diferenca: lost ? r2(base(s) - pago(s)) : 0, title: "Status diferente entre as bases",
        detail: `Workinfinity: ${w.status ?? "—"} · Stone: ${s.status ?? "—"} · pago ${brl(pago(s))}.` });
    }
    if (!s.was_realigned && s.visitas != null && w.numero_visitas != null && s.visitas !== w.numero_visitas)
      add({ rule_key: "status_or_visits_mismatch", severity: s.visitas < w.numero_visitas ? "medium" : "low", ...common(s),
        title: "Número de visitas diferente", detail: `Workinfinity: ${w.numero_visitas} · Stone: ${s.visitas}.` });
  }

  // Tabela de preços (manual tem prioridade; senão moda do período, mínimo de 3 OS)
  const pkey = (p: string | null, g: string | null, r: string | null) => [norm(p), norm(g), norm(r)].join("|");
  const expected = new Map<string, number>();
  const bucket = new Map<string, number[]>();
  for (const s of stone) if (base(s) > 0) { const k = pkey(s.produto, s.grupo_servico, s.raio); bucket.set(k, [...(bucket.get(k) ?? []), base(s)]); }
  for (const [k, v] of bucket) if (v.length >= 3) { const m = rawMode(v); if (m != null) expected.set(k, m); }
  for (const p of input.prices ?? []) expected.set(pkey(p.produto, p.grupo_servico, p.raio), p.expected_valor_base);

  // R4 — decomposição e baixa tardia
  const dec = { p40: { n: 0, valor: 0 }, tardia: { n: 0, valor: 0 }, multa: { n: 0, valor: 0 }, outros: { n: 0, valor: 0 } };
  const bySc = new Map<string, StoneRow[]>();
  for (const s of stone) if (s.stonecode) bySc.set(s.stonecode, [...(bySc.get(s.stonecode) ?? []), s]);
  const prevVisit = (s: StoneRow) => {
    const d = dayOf(s.data_atendimento);
    if (!d) return null;
    let best: StoneRow | null = null;
    for (const o of bySc.get(s.stonecode ?? "") ?? []) {
      const od = dayOf(o.data_atendimento);
      if (o !== s && od && od < d && (!best || od > (dayOf(best.data_atendimento) as string))) best = o;
    }
    return best;
  };
  for (const s of stone) {
    const raw = base(s) - pago(s); // valores da Stone podem ter mais de 2 casas: acumular sem arredondar por linha
    const diff = r2(raw);
    if (Math.abs(raw) < 0.005) continue;
    const cat = payCat(s.status_pagamento);
    if (cat === "tardia") {
      dec.tardia.n++; dec.tardia.valor += raw;
      const p = prevVisit(s);
      let sev: Severity = "low", why = "Aberta antes da visita anterior ao mesmo cliente: consistente com a regra da Stone.";
      if (!p) { sev = "high"; why = "Não há visita anterior ao mesmo cliente na apuração do mês: a retenção não se explica pela regra."; }
      else {
        const ab = dayOf(s.data_abertura), pd = dayOf(p.data_atendimento) as string;
        if (!ab) { sev = "medium"; why = "Sem data de abertura para conferir contra a visita anterior."; }
        else if (ab > pd) { sev = "high"; why = "OS aberta DEPOIS da visita anterior: retenção indevida."; }
        else if (ab === pd) {
          if (hasTime(s.data_abertura) && hasTime(p.data_atendimento))
            if (Date.parse(s.data_abertura as string) > Date.parse(p.data_atendimento as string)) { sev = "high"; why = "Aberta no mesmo dia, mas depois do horário da visita anterior: retenção indevida."; }
            else why = "Aberta no mesmo dia, antes do horário da visita anterior: consistente com a regra da Stone.";
          else { sev = "medium"; why = "Aberta no mesmo dia da visita anterior: conferir o horário de abertura."; }
        }
        if (sev === "low" && pago(p) === 0) { sev = "medium"; why += " A visita anterior também não foi paga."; }
        why += ` Visita anterior: OS ${p.os} em ${dayOf(p.data_atendimento)}.`;
      }
      add({ rule_key: "payment_difference", severity: sev, ...common(s), diferenca: diff, title: "Baixa tardia após visita anterior (pago zero)", detail: why });
    } else if (z(s.multa) > 0 && cat !== "p40") {
      dec.multa.n++; dec.multa.valor += raw;
      add({ rule_key: "payment_difference", severity: "low", ...common(s), diferenca: diff, title: "Multa aplicada", detail: `Multa de ${brl(z(s.multa))} sobre base de ${brl(base(s))}.` });
    } else if (cat === "p40") { dec.p40.n++; dec.p40.valor += raw; }
    else {
      dec.outros.n++; dec.outros.valor += raw;
      add({ rule_key: "payment_difference", severity: "medium", ...common(s), diferenca: diff, title: "Diferença sem motivo informado",
        detail: `Base ${brl(base(s))}, pago ${brl(pago(s))}, status de pagamento: ${s.status_pagamento ?? "—"}.` });
    }
  }

  // R5 — regra de visita 100% / 40%
  const groups = new Map<string, StoneRow[]>();
  for (const s of stone) { const d = dayOf(s.data_atendimento); if (s.stonecode && d) { const k = `${s.stonecode}|${d}`; groups.set(k, [...(groups.get(k) ?? []), s]); } }
  for (const g of groups.values()) {
    const max = Math.max(...g.map(base));
    const full = g.filter((x) => payCat(x.status_pagamento) === "p100");
    if (g.length > 1 && full.length > 1)
      for (const s of full) add({ rule_key: "visit_rule_40pct", severity: "high", ...common(s), diferenca: r2(base(s) * 0.6), title: "Mais de uma OS a 100% na mesma visita", detail: "Esperado: uma OS a 100% e as demais a 40%." });
    for (const s of g) {
      const cat = payCat(s.status_pagamento);
      if (cat === "p100" && g.length > 1 && base(s) < max - 0.005)
        add({ rule_key: "visit_rule_40pct", severity: "high", ...common(s), title: "100% em OS que não é a de maior valor", detail: "A OS de maior valor base do grupo deveria receber 100%." });
      if (cat === "p40" && Math.abs(pago(s) - base(s) * 0.4) > 0.02 && z(s.multa) === 0)
        add({ rule_key: "visit_rule_40pct", severity: "high", ...common(s), diferenca: r2(Math.max(0, base(s) * 0.4 - pago(s))), title: "40% calculado incorretamente", detail: `Esperado ${brl(base(s) * 0.4)}, pago ${brl(pago(s))}.` });
    }
  }

  // R6 — anomalias; R7 — tabela de preços; R8 — raio × distância
  for (const s of stone) {
    const exp = expected.get(pkey(s.produto, s.grupo_servico, s.raio));
    if (pago(s) < 0)
      add({ rule_key: "payment_anomalies", severity: "high", ...common(s), diferenca: r2(-pago(s)), title: "Valor pago negativo", detail: `Multa ${brl(z(s.multa))} acima da base ${brl(base(s))}.` });
    else if (z(s.multa) > base(s) && base(s) > 0)
      add({ rule_key: "payment_anomalies", severity: "medium", ...common(s), title: "Multa maior que o valor base", detail: `Multa ${brl(z(s.multa))} · base ${brl(base(s))}.` });
    if (base(s) === 0 && z(s.visitas) > 0 && /baixada|cancelada/.test(norm(s.status)))
      add({ rule_key: "payment_anomalies", severity: "high", ...common(s), diferenca: exp ?? 0, title: "Valor base zerado em OS com visita",
        detail: exp ? `Valor típico para este produto, serviço e raio: ${brl(exp)}.` : "Sem valor de referência na tabela de preços." });
    if (z(s.multa) > 0 && hasAbono(s.abono))
      add({ rule_key: "payment_anomalies", severity: "medium", ...common(s), diferenca: r2(z(s.multa)), title: "Multa aplicada em OS com abono", detail: `Abono: ${s.abono}.` });
    if (exp != null && base(s) > 0 && Math.abs(base(s) - exp) > 0.02)
      add({ rule_key: "price_table_deviation", severity: base(s) < exp ? "medium" : "low", ...common(s), diferenca: r2(Math.max(0, exp - base(s))),
        title: "Valor base fora da tabela de preços", detail: `Esperado ${brl(exp)}, apurado ${brl(base(s))}.` });
    const km = s.distancia_km, band = s.raio ? RADIUS_BANDS[s.raio.toUpperCase()] : undefined;
    if (km != null && km > 1000)
      add({ rule_key: "radius_distance_mismatch", severity: "medium", ...common(s), title: "Distância improvável", detail: `${km.toLocaleString("pt-BR")} km: possível erro de geolocalização (raio ${s.raio ?? "—"}).` });
    else if (km != null && band && (km < band[0] || km > band[1]))
      add({ rule_key: "radius_distance_mismatch", severity: "medium", ...common(s), title: "Raio incoerente com a distância", detail: `${km.toLocaleString("pt-BR")} km classificados como ${s.raio}.` });
  }

  // R9 — triagem
  if (triagem.length) {
    const sum = r2(triagem.reduce((a, t) => a + z(t.valor_triagem), 0));
    const odd = triagem.filter((t) => (isGood(t.status_triagem) ? Math.abs(z(t.valor_triagem) - 5) > 0.01 : z(t.valor_triagem) > 0));
    if (odd.length) add({ rule_key: "triage_payment_mismatch", severity: "medium", title: "Triagem fora do padrão de R$ 5,00 por GOOD", diferenca: 0, detail: `${odd.length} equipamento(s) com valor diferente do esperado.` });
    const c = input.consolidado?.triagem;
    if (c != null && Math.abs(sum - c) > 0.02)
      add({ rule_key: "triage_payment_mismatch", severity: "high", title: "Soma da triagem diferente do Consolidado", diferenca: r2(Math.abs(sum - c)), detail: `Analítico ${brl(sum)} · Consolidado ${brl(c)}.` });
  }

  // Resumos
  const mkGroups = (keyOf: (s: StoneRow) => string): Group[] => {
    const m = new Map<string, { n: number; b: number; nb: number; base: number; pago: number; t: number; d: number; nd: number }>();
    for (const s of stone) {
      const k = keyOf(s), o = m.get(k) ?? { n: 0, b: 0, nb: 0, base: 0, pago: 0, t: 0, d: 0, nd: 0 };
      o.n++; if (norm(s.status) === "baixada") o.b++; else o.nb++;
      o.base += base(s); o.pago += pago(s); if (payCat(s.status_pagamento) === "tardia") o.t++;
      if (!s.was_realigned && s.dias_ate_atendimento != null) { o.d += s.dias_ate_atendimento; o.nd++; }
      m.set(k, o);
    }
    return [...m.entries()].map(([key, o]) => ({ key, n: o.n, baixadas: o.b, naoBaixadas: o.nb, base: r2(o.base), pago: r2(o.pago),
      retido: r2(o.base - o.pago), tardia: o.t, prazoMedio: o.nd ? r2(o.d / o.nd) : null })).sort((a, b) => b.n - a.n);
  };
  const cancel = new Map<string, { n: number; visitas: number; base: number; pago: number }>();
  for (const s of stone) if (norm(s.status) !== "baixada") {
    const k = s.motivo_cancelamento ?? "Sem motivo informado", o = cancel.get(k) ?? { n: 0, visitas: 0, base: 0, pago: 0 };
    o.n++; o.visitas += z(s.visitas); o.base += base(s); o.pago += pago(s); cancel.set(k, o);
  }
  const late = stone.flatMap((s) => {
    const a = dayOf(s.data_atendimento), l = dayOf(s.data_limite_atendimento);
    return a && l && a > l ? [{ os: s.os, tecnico: tec(s), limite: l, atendida: a, diasAtraso: daysBetween(a, l), multa: z(s.multa), abono: hasAbono(s.abono), pago: pago(s) }] : [];
  });
  const dm = new Map<string, { n: number; pago: number }>();
  for (const s of stone) { const d = dayOf(s.data_atendimento); if (d) { const o = dm.get(d) ?? { n: 0, pago: 0 }; o.n++; o.pago += pago(s); dm.set(d, o); } }
  const totalBase = r2(stone.reduce((a, s) => a + base(s), 0)), totalPago = r2(stone.reduce((a, s) => a + pago(s), 0));
  const c = input.consolidado;
  const cPago = c && c.stone != null && c.ton != null && c.bobina != null ? r2(c.stone + c.ton + c.bobina) : null;
  const round = (o: { n: number; valor: number }) => ({ n: o.n, valor: r2(o.valor) });
  return {
    findings,
    reconciliation: { base: totalBase, pago: totalPago, retido: r2(totalBase - totalPago), consolidadoPago: cPago, validationDiff: cPago == null ? null : r2(totalPago - cPago) },
    decomposition: { p40: round(dec.p40), tardia: round(dec.tardia), multa: round(dec.multa), outros: round(dec.outros) },
    byTechnician: mkGroups((s) => tec(s) ?? "Sem técnico"),
    byService: mkGroups((s) => `${s.produto ?? "—"} · ${s.grupo_servico ?? "—"}`),
    byCancelReason: [...cancel.entries()].map(([motivo, o]) => ({ motivo, n: o.n, visitas: o.visitas, base: r2(o.base), pago: r2(o.pago) })).sort((a, b) => b.n - a.n),
    late, daily: [...dm.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([dia, o]) => ({ dia, n: o.n, pago: r2(o.pago) })),
    counts: { workinfinity: wi.length, stone: stone.length, baixadas: stone.filter((s) => norm(s.status) === "baixada").length,
      naoBaixadas: stone.filter((s) => norm(s.status) !== "baixada").length, soWorkinfinity: onlyWi.length, soStone: onlyStone.length },
  };
}

/** Valor em risco: soma de `diferenca` dos achados abertos (pendente/contestar). */
export const valueAtRisk = (rows: { diferenca: number | null; review_status: string }[]) =>
  r2(rows.filter((r) => r.review_status === "pendente" || r.review_status === "contestar").reduce((a, r) => a + z(r.diferenca), 0));
