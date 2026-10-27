import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";
import { normalizeName, type FileKind } from "./import-types";

type Insert<T extends keyof Database["public"]["Tables"]> = Omit<Database["public"]["Tables"][T]["Insert"], "audit_period_id">;
type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;
export interface ParsedImport {
  version: 1;
  file_kind: FileKind;
  detected_raw_name: string | null;
  row_count: number;
  realigned_rows_count: number;
  workinfinity: Insert<"workinfinity_records">[];
  stone: Insert<"stone_os_records">[];
  triagem: Insert<"stone_triagem_records">[];
  bonificacao: Insert<"stone_bonificacao_records">[];
  totals: Record<string, number | null>;
}
export const headerKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (v: unknown): string | null => v == null || String(v).trim() === "" ? null : String(v).trim();
export const cleanSerial = (v: unknown) => text(v)?.replace(/^[=\s"]+|["\s]+$/g, "") ?? null;
function get(row: Row, ...keys: string[]): Cell {
  for (const key of keys) { const value = row[headerKey(key)]; if (value != null && value !== "") return value; }
  return null;
}
export function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value ?? "").trim().replace(/R\$|\s|%/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
function numeric(row: Row, key: string, ...aliases: string[]) {
  const raw = get(row, key, ...aliases);
  const n = numberValue(raw);
  if (raw !== null && n === null) throw new Error(`Valor numérico inválido na coluna ${key}.`);
  return n;
}
function dateValue(value: Cell, monthOnly = false): string | null {
  if (value == null || value === "") return null;
  let s = String(value).trim();
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) throw new Error("Data inválida na planilha.");
    s = `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}T${String(d.H).padStart(2,"0")}:${String(d.M).padStart(2,"0")}:${String(d.S).padStart(2,"0")}-03:00`;
  } else {
    const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/);
    if (match) s = `${match[3]}-${match[2]}-${match[1]}T${match[4] ?? "00:00:00"}-03:00`;
    if (/^\d{4}-\d{2}$/.test(s)) s += "-01";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T00:00:00-03:00";
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida no arquivo.");
  return monthOnly ? `${s.slice(0,7)}-01` : d.toISOString();
}
function rowsFromGrid(grid: Cell[][], required: string[]): Row[] {
  const index = grid.findIndex(row => required.every(key => row.some(c => headerKey(String(c ?? "")) === headerKey(key))));
  if (index < 0) throw new Error(`Cabeçalho ausente: ${required.join(", ")}.`);
  const headers = grid[index] ?? [];
  return grid.slice(index+1).filter(r => r.some(c => c != null && c !== "")).map(r => Object.fromEntries(headers.map((h,i) => [headerKey(String(h ?? "")), r[i] ?? null])));
}
function detectName(rows: Row[]): string | null {
  const names = [...new Set(rows.map(r => text(get(r,"prestador","franquia","nome franquia","nome do prestador"))).filter((v): v is string => Boolean(v)))];
  if (new Set(names.map(normalizeName)).size > 1) throw new Error("O arquivo contém mais de uma franquia. Separe os arquivos por franquia.");
  return names[0] ?? null;
}
export function realignStone(row: Row) {
  const paid = get(row,"valor_pago");
  const shifted = normalizeName(String(get(row,"status") ?? "")) === "(TRATAMENTO) SEM RETORNO" && text(paid) !== null && numberValue(paid) === null;
  if (shifted) {
    const base = numeric(row,"multa"), payment = numeric(row,"em_auditoria");
    if (base === null || payment === null) throw new Error("Linha Sem Retorno sem valores suficientes para realinhamento.");
    // Nas linhas deslocadas, Raio fica na coluna Abono, Abono na coluna Visitas e os dias até o atendimento na coluna Raio.
    const abonoCell = get(row,"abono"), raioCell = get(row,"raio");
    const shiftedColumns = /^R\d$/i.test(String(abonoCell ?? ""))
      ? { raio: String(abonoCell).toUpperCase(), abono: text(get(row,"visitas")), visitas: null as number | null, dias_ate_atendimento: numberValue(raioCell) }
      : {};
    return { multa: 0, em_auditoria: 0, valor_base_os: base, valor_pago: payment, status_pagamento: text(paid), was_realigned: true, ...shiftedColumns };
  }
  return { multa: numeric(row,"multa"), em_auditoria: numeric(row,"em_auditoria"), valor_base_os: numeric(row,"valor_base_os","valor base"), valor_pago: numeric(row,"valor_pago"), status_pagamento: text(get(row,"status_pagamento")), was_realigned: false };
}
const round = (n: number) => Math.round((n + Number.EPSILON)*100)/100;
export function validationDifference(paid: number, stone: number, ton: number, bobina: number) { return round(paid-stone-ton-bobina); }
export function parseImport(bytes: Uint8Array, filename: string): ParsedImport {
  const out: ParsedImport = { version:1,file_kind:"workinfinity_csv",detected_raw_name:null,row_count:0,realigned_rows_count:0,workinfinity:[],stone:[],triagem:[],bonificacao:[],totals:{} };
  if (/\.csv$/i.test(filename)) {
    const csv = Papa.parse<Cell[]>(new TextDecoder("windows-1252").decode(bytes), { delimiter:";", skipEmptyLines:"greedy" });
    if (csv.errors.length) throw new Error("CSV inválido: confira as aspas e o separador ponto e vírgula.");
    const rows = rowsFromGrid(csv.data,["Chamado"]);
    out.detected_raw_name = detectName(rows);
    out.workinfinity = rows.filter(r => text(get(r,"chamado"))).map(r => {
      const chamado = String(get(r,"chamado"));
      return { chamado, chamado_key:chamado.replace(/\s/g,""), status:text(get(r,"status")), contratante:text(get(r,"contratante")), grupo_servico:text(get(r,"grupo_servico","grupo de serviço")), prestador:text(get(r,"prestador")), tecnico:text(get(r,"tecnico")), cidade:text(get(r,"cidade")), numero_visitas:numeric(r,"numero_visitas","número de visitas","visitas"), abono:text(get(r,"abono")), descricao_motivo:null, data_atendimento:dateValue(get(r,"data_atendimento","data de atendimento")), serial_instalado:cleanSerial(get(r,"serial_instalado")), serial_retirado:cleanSerial(get(r,"serial_retirado")) };
    });
    // Free-form descriptions are excluded too: they may contain customer PII.
    out.row_count = out.workinfinity.length;
  } else if (/\.xlsx$/i.test(filename) && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    out.file_kind = "stone_xlsx";
    const book = XLSX.read(bytes,{type:"array",cellFormula:false,cellHTML:false});
    const sheet = (name:string) => {
      const key = book.SheetNames.find(s => headerKey(s) === headerKey(name));
      const s = key ? book.Sheets[key] : undefined;
      if (!s) throw new Error(`Aba obrigatória ausente: ${name}.`);
      return XLSX.utils.sheet_to_json<Cell[]>(s,{header:1,defval:null,raw:true});
    };
    const consolidated = rowsFromGrid(sheet("Consolidado"),["Stone","Ton","Bobina"]);
    if (consolidated.length !== 1) throw new Error("Consolidado deve conter uma linha por arquivo/franquia.");
    const c = consolidated[0];
    if (!c) throw new Error("Consolidado vazio.");
    const rows = rowsFromGrid(sheet("Analítico da OS"),["OS","Status","Valor_pago"]);
    out.detected_raw_name = detectName(consolidated) ?? detectName(rows);
    out.stone = rows.filter(r => text(get(r,"os"))).map(r => {
      const os = String(get(r,"os"));
      return { os,os_key:os.replace(/\s/g,""),stonecode:text(get(r,"stonecode")),cidade:text(get(r,"cidade")),uf:text(get(r,"uf")),produto:text(get(r,"produto")),grupo_servico:text(get(r,"grupo_servico","grupo de serviço")),data_abertura:dateValue(get(r,"data_abertura")),data_limite_atendimento:dateValue(get(r,"data_limite_atendimento")),data_atendimento:dateValue(get(r,"data_atendimento")),distancia_km:numeric(r,"distancia_km","distancia","km"),nome_tecnico:text(get(r,"nome_tecnico","tecnico")),status:text(get(r,"status")),motivo_cancelamento:null,visitas:numeric(r,"visitas"),atraso:text(get(r,"atraso")),abono:text(get(r,"abono")),raio:text(get(r,"raio")),dias_ate_atendimento:numeric(r,"dias_ate_atendimento"),atraso_dias_uteis:numeric(r,"atraso_dias_uteis"),...realignStone(r) };
    });
    const tri = sheet("Analítico Triagem");
    out.triagem = tri.length < 2 ? [] : rowsFromGrid(tri,["Serial"]).filter(r => text(get(r,"serial"))).map(r => ({serial:cleanSerial(get(r,"serial")),mes_ref:dateValue(get(r,"mes_ref","mes ref"),true),status_triagem:text(get(r,"status_triagem","status")),valor_triagem:numeric(r,"valor_triagem","valor") }));
    const bonus = sheet("Bonificação");
    out.bonificacao = bonus.length < 2 ? [] : rowsFromGrid(bonus,["TMA_Stone"]).map(r => ({tma_stone:numeric(r,"tma_stone"),tma_ton:numeric(r,"tma_ton"),ciclo:text(get(r,"ciclo")),retirados:numeric(r,"retirados"),triados:numeric(r,"triados"),triados_good:numeric(r,"triados_good"),aproveitamento_triagem:numeric(r,"aproveitamento_triagem"),rv_payload:Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith("rv")).map(([k,v]) => [k,numberValue(v)])) }));
    const stone = numeric(c,"Stone"), ton = numeric(c,"Ton"), bobina = numeric(c,"Bobina");
    if (stone === null || ton === null || bobina === null) throw new Error("Consolidado sem valores Stone, Ton ou Bobina.");
    const base = round(out.stone.reduce((a,r) => a+(r.valor_base_os ?? 0),0));
    const paid = round(out.stone.reduce((a,r) => a+(r.valor_pago ?? 0),0));
    out.totals = {consolidado_stone:stone,consolidado_ton:ton,consolidado_bobina:bobina,consolidado_triagem:numeric(c,"Triagem"),consolidado_total:numeric(c,"Total"),total_valor_base:base,total_valor_pago:paid,total_difference:round(base-paid),total_validation_diff:validationDifference(paid,stone,ton,bobina)};
    out.row_count = out.stone.length;
    out.realigned_rows_count = out.stone.filter(r => r.was_realigned).length;
  } else throw new Error("Formato não reconhecido. Envie CSV Workinfinity ou XLSX Stone.");
  if (!out.row_count) throw new Error("O arquivo não contém registros operacionais.");
  return out;
}