import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const FINDING_COLS = "id,rule_id,os,stonecode,grupo_servico,tecnico,cidade,data_atendimento,valor_base_os,valor_pago,diferenca,severity,title,detail,review_status,observation";

/** Detalhe da franquia: período, achados gravados (com revisão) e resumos calculados pelo motor. */
export const getFranchiseAudit = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ franchise_id: z.string().uuid(), month }))
  .handler(async ({ data, context }) => {
    const { fetchAll, loadPeriodInput, summarize } = await import("./audit.server");
    const { runAudit } = await import("./audit/engine");
    const db = context.supabase;
    const [franchise, period, rules] = await Promise.all([
      db.from("franchises").select("id,display_name").eq("id", data.franchise_id).single(),
      db.from("audit_periods").select("id,status,stone_file_id,workinfinity_file_id,realigned_rows_count,total_valor_base,total_valor_pago,total_difference,total_validation_diff,open_findings_count,value_at_risk,processed_at").eq("franchise_id", data.franchise_id).eq("reference_month", `${data.month}-01`).maybeSingle(),
      db.from("audit_rules").select("id,rule_key,name"),
    ]);
    if (franchise.error || !franchise.data) throw new Error("Franquia não encontrada.");
    if (period.error || rules.error) throw new Error("Não foi possível carregar a auditoria.");
    const p = period.data;
    const ready = Boolean(p?.stone_file_id && p.workinfinity_file_id);
    if (!p || !ready) return { franchise: franchise.data, period: p, ready, findings: [], rules: rules.data ?? [], summary: null };
    const findings = await fetchAll<{ id: string; rule_id: number; os: string | null; stonecode: string | null; grupo_servico: string | null; tecnico: string | null; cidade: string | null; data_atendimento: string | null; valor_base_os: number | null; valor_pago: number | null; diferenca: number | null; severity: string; title: string; detail: string | null; review_status: string; observation: string | null }>(
      (f, t) => db.from("audit_findings").select(FINDING_COLS).eq("audit_period_id", p.id).order("diferenca", { ascending: false }).order("id").range(f, t));
    const { input } = await loadPeriodInput(db, p.id);
    return { franchise: franchise.data, period: p, ready, findings, rules: rules.data ?? [], summary: summarize(runAudit(input)) };
  });

export const processAuditPeriod = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ audit_period_id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { processPeriod } = await import("./audit.server");
    return processPeriod(data.audit_period_id);
  });

export const updateFindingReview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), review_status: z.enum(["pendente", "contestar", "aceito"]), observation: z.string().max(2000).nullable().optional() }))
  .handler(async ({ data, context }) => {
    const { refreshPeriodCounters } = await import("./audit.server");
    const patch: { review_status: string; observation?: string | null } = { review_status: data.review_status };
    if (data.observation !== undefined) patch.observation = data.observation?.trim() ? data.observation.trim() : null;
    const { data: row, error } = await context.supabase.from("audit_findings").update(patch).eq("id", data.id).select("audit_period_id").single();
    if (error || !row) throw new Error("Não foi possível salvar a revisão.");
    return refreshPeriodCounters(row.audit_period_id);
  });

/** Achados marcados para contestar no mês, de todas as franquias. */
export const getContestations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ month }))
  .handler(async ({ data, context }) => {
    const { fetchAll } = await import("./audit.server");
    const db = context.supabase;
    const periods = await db.from("audit_periods").select("id,franchise_id").eq("reference_month", `${data.month}-01`);
    const franchises = await db.from("franchises").select("id,display_name");
    if (periods.error || franchises.error) throw new Error("Não foi possível carregar as contestações.");
    const name = new Map((franchises.data ?? []).map((f) => [f.id, f.display_name]));
    const ids = (periods.data ?? []).map((p) => p.id);
    if (!ids.length) return { items: [] as { id: string; franchise_id: string; franchise: string; os: string | null; title: string; detail: string | null; severity: string; tecnico: string | null; grupo_servico: string | null; data_atendimento: string | null; valor_base_os: number | null; valor_pago: number | null; diferenca: number | null; observation: string | null }[] };
    const rows = await fetchAll<{ id: string; franchise_id: string; os: string | null; title: string; detail: string | null; severity: string; tecnico: string | null; grupo_servico: string | null; data_atendimento: string | null; valor_base_os: number | null; valor_pago: number | null; diferenca: number | null; observation: string | null }>(
      (f, t) => db.from("audit_findings").select("id,franchise_id,os,title,detail,severity,tecnico,grupo_servico,data_atendimento,valor_base_os,valor_pago,diferenca,observation").in("audit_period_id", ids).eq("review_status", "contestar").order("diferenca", { ascending: false }).order("id").range(f, t));
    return { items: rows.map((r) => ({ ...r, franchise: name.get(r.franchise_id) ?? "—" })) };
  });
