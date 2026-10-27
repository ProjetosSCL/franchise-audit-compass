import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { runAudit, valueAtRisk, type AuditInput, type AuditResult, type RuleKey, type StoneRow, type TriagemRow, type WiRow } from "./audit/engine";

type Db = SupabaseClient<Database>;
type FindingInsert = Database["public"]["Tables"]["audit_findings"]["Insert"];
const PAGE = 1000;

export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error("Não foi possível carregar os registros do período.");
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const STONE_COLS = "os,os_key,stonecode,cidade,produto,grupo_servico,data_abertura,data_limite_atendimento,data_atendimento,distancia_km,nome_tecnico,status,motivo_cancelamento,visitas,abono,raio,dias_ate_atendimento,multa,valor_base_os,valor_pago,status_pagamento,was_realigned";
const WI_COLS = "chamado,chamado_key,status,contratante,grupo_servico,tecnico,cidade,numero_visitas,data_atendimento";

/** Carrega os registros do período e monta a entrada do motor (usa o cliente recebido: RLS do usuário ou service role). */
export async function loadPeriodInput(client: Db, periodId: string) {
  const periodRes = await client.from("audit_periods").select("*").eq("id", periodId).single();
  if (periodRes.error || !periodRes.data) throw new Error("Período não encontrado.");
  const period = periodRes.data;
  const [stone, workinfinity, triagem, rules, prices] = await Promise.all([
    fetchAll<StoneRow>((f, t) => client.from("stone_os_records").select(STONE_COLS).eq("audit_period_id", periodId).order("id").range(f, t)),
    fetchAll<WiRow>((f, t) => client.from("workinfinity_records").select(WI_COLS).eq("audit_period_id", periodId).order("id").range(f, t)),
    fetchAll<TriagemRow>((f, t) => client.from("stone_triagem_records").select("serial,status_triagem,valor_triagem").eq("audit_period_id", periodId).order("id").range(f, t)),
    client.from("audit_rules").select("id,rule_key,is_enabled"),
    client.from("price_table_entries").select("produto,grupo_servico,raio,expected_valor_base"),
  ]);
  if (rules.error || prices.error) throw new Error("Não foi possível carregar as regras de auditoria.");
  const input: AuditInput = {
    stone, workinfinity, triagem, prices: prices.data ?? [],
    consolidado: { stone: period.consolidado_stone, ton: period.consolidado_ton, bobina: period.consolidado_bobina, triagem: period.consolidado_triagem },
    enabledRules: (rules.data ?? []).filter((r) => r.is_enabled).map((r) => r.rule_key as RuleKey),
  };
  return { period, input, rules: rules.data ?? [] };
}

export function summarize(result: AuditResult) {
  const { findings: _findings, ...summary } = result;
  return summary;
}

export async function processPeriod(periodId: string) {
  try {
    const { period, input, rules } = await loadPeriodInput(supabaseAdmin, periodId);
    if (!period.stone_file_id || !period.workinfinity_file_id)
      throw new Error("Importe a apuração da Stone e o relatório do Workinfinity para processar.");
    const ruleId = new Map(rules.map((r) => [r.rule_key, r.id]));
    const result = runAudit(input);
    const missing = [...new Set(result.findings.map((f) => f.rule_key))].filter((k) => !ruleId.has(k));
    if (missing.length) throw new Error(`Regras não cadastradas em audit_rules: ${missing.join(", ")}.`);

    // Preserva revisões humanas de achados que continuam válidos (mesma regra, OS e título).
    const old = await fetchAll<{ id: string; rule_id: number; os: string | null; title: string; review_status: string; observation: string | null; ai_explanation: string | null; ai_contestation_text: string | null; reviewed_by: string | null; reviewed_at: string | null }>(
      (f, t) => supabaseAdmin.from("audit_findings").select("id,rule_id,os,title,review_status,observation,ai_explanation,ai_contestation_text,reviewed_by,reviewed_at").eq("audit_period_id", periodId).order("id").range(f, t));
    const kept = new Map(old.map((o) => [`${o.rule_id}|${o.os ?? ""}|${o.title}`, o]));
    const rows: FindingInsert[] = result.findings.map((f) => {
      const id = ruleId.get(f.rule_key) as number;
      const prev = kept.get(`${id}|${f.os ?? ""}|${f.title}`);
      return {
        audit_period_id: periodId, franchise_id: period.franchise_id, rule_id: id, os: f.os, stonecode: f.stonecode, grupo_servico: f.grupo_servico,
        tecnico: f.tecnico, cidade: f.cidade, data_atendimento: f.data_atendimento, valor_base_os: f.valor_base_os, valor_pago: f.valor_pago,
        diferenca: f.diferenca, severity: f.severity, title: f.title, detail: f.detail,
        review_status: prev?.review_status ?? f.auto_review ?? "pendente", observation: prev?.observation ?? null,
        ai_explanation: prev?.ai_explanation ?? null, ai_contestation_text: prev?.ai_contestation_text ?? null,
        reviewed_by: prev?.reviewed_by ?? null, reviewed_at: prev?.reviewed_at ?? null,
      };
    });
    // Insere os novos primeiro e só então remove os antigos: uma falha no meio não apaga a revisão existente.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from("audit_findings").insert(rows.slice(i, i + 500));
      if (error) throw new Error("Não foi possível gravar os achados.");
    }
    for (let i = 0; i < old.length; i += 100) {
      const { error } = await supabaseAdmin.from("audit_findings").delete().in("id", old.slice(i, i + 100).map((o) => o.id));
      if (error) throw new Error("Não foi possível substituir os achados anteriores.");
    }
    const counters = await refreshPeriodCounters(periodId, { status: "processed", processed_at: new Date().toISOString(), total_validation_diff: result.reconciliation.validationDiff });
    return { findings_created: rows.length, ...counters };
  } catch (error) {
    await supabaseAdmin.from("audit_periods").update({ status: "error" }).eq("id", periodId);
    throw error;
  }
}

export async function processPeriodIfReady(periodId: string) {
  const { data } = await supabaseAdmin.from("audit_periods").select("stone_file_id,workinfinity_file_id").eq("id", periodId).single();
  return data?.stone_file_id && data.workinfinity_file_id ? processPeriod(periodId) : null;
}

export async function refreshPeriodCounters(periodId: string, extra: Database["public"]["Tables"]["audit_periods"]["Update"] = {}) {
  const rows = await fetchAll<{ diferenca: number | null; review_status: string }>(
    (f, t) => supabaseAdmin.from("audit_findings").select("diferenca,review_status").eq("audit_period_id", periodId).order("id").range(f, t));
  const open_findings_count = rows.filter((r) => r.review_status === "pendente").length;
  const value_at_risk = valueAtRisk(rows);
  const { error } = await supabaseAdmin.from("audit_periods").update({ ...extra, open_findings_count, value_at_risk }).eq("id", periodId);
  if (error) throw new Error("Não foi possível atualizar os totais do período.");
  return { open_findings_count, value_at_risk };
}
