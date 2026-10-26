export type FileKind = "workinfinity_csv" | "stone_xlsx";
export interface ImportResult {
  uploaded_file_id: string;
  original_filename: string;
  file_kind: FileKind;
  detected_raw_name: string | null;
  franchise_id: string | null;
  audit_period_id: string | null;
  row_count: number;
  realigned_rows_count: number;
  total_validation_diff: number | null;
  needs_manual_association: boolean;
}
export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}
export function validateMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) throw new Error("Mês de referência inválido.");
  return value;
}