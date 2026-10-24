import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Painel geral: lista das 8 franquias fixas + todos os períodos já
 * importados. O cliente filtra pelo mês selecionado. RLS garante que só
 * sócios autenticados leem estes dados.
 */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    const [franchisesRes, periodsRes] = await Promise.all([
      supabase
        .from("franchises")
        .select("id, code, display_name")
        .eq("is_active", true)
        .order("display_name", { ascending: true }),
      supabase
        .from("audit_periods")
        .select(
          "id, franchise_id, reference_month, status, total_valor_base, total_valor_pago, total_difference, open_findings_count, value_at_risk, total_validation_diff, realigned_rows_count",
        ),
    ]);

    if (franchisesRes.error) throw new Error(franchisesRes.error.message);
    if (periodsRes.error) throw new Error(periodsRes.error.message);

    return { franchises: franchisesRes.data ?? [], periods: periodsRes.data ?? [] };
  });
