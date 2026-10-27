export const brl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1).replace(".", ",")}%` : "0,0%");
export const fmtDay = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const [y, m, d] = new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
export const SEVERITY: Record<string, { label: string; rank: number; cls: string }> = {
  high: { label: "Alta", rank: 0, cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  medium: { label: "Média", rank: 1, cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  low: { label: "Baixa", rank: 2, cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  info: { label: "Info", rank: 3, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
};
export const REVIEW_LABEL: Record<string, string> = { pendente: "Pendente", contestar: "Contestar", aceito: "Aceito" };
