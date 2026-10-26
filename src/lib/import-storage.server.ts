import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeName, type ImportResult } from "./import-types";
import type { ParsedImport } from "./import-parser.server";
import type { Database } from "@/integrations/supabase/types";

type Metadata = { id: string; reference_month: string; storage_path: string; original_filename: string };
export async function commitImport(meta: Metadata, parsed: ParsedImport, franchiseId: string | null, userId: string, saveAlias = false): Promise<ImportResult> {
  // Generated RPC types don't express nullable UUID arguments; Postgres accepts null.
  type Args = Database["public"]["Functions"]["commit_month_import"]["Args"];
  const args: Omit<Args,"p_franchise_id"> & {p_franchise_id:string|null} = {
    p_file: meta, p_data: JSON.parse(JSON.stringify(parsed)), p_franchise_id: franchiseId,
    p_user_id:userId,p_save_alias:saveAlias,
  };
  const { data: periodId, error } = await supabaseAdmin.rpc("commit_month_import", args as Args);
  if (error) {
    // Never log the parsed payload: it contains operational records.
    console.error("Import transaction failed", error.code);
    throw new Error("Não foi possível salvar a importação. Nenhum registro deste arquivo foi alterado.");
  }
  return {uploaded_file_id:meta.id,original_filename:meta.original_filename,file_kind:parsed.file_kind,detected_raw_name:parsed.detected_raw_name,franchise_id:franchiseId,audit_period_id:periodId ?? null,row_count:parsed.row_count,realigned_rows_count:parsed.realigned_rows_count,total_validation_diff:parsed.totals["total_validation_diff"] ?? null,needs_manual_association:franchiseId === null};
}
export async function storeImport(parsed: ParsedImport, filename: string, month: string, userId: string, franchiseId: string | null) {
  const id = crypto.randomUUID();
  const meta = {id,reference_month:month,storage_path:`${month}/${id}.sanitized.json`,original_filename:filename};
  const { error } = await supabaseAdmin.storage.from("source-files").upload(meta.storage_path,new Blob([JSON.stringify(parsed)],{type:"application/json"}),{contentType:"application/json",upsert:false});
  if (error) throw new Error("Não foi possível salvar o arquivo tratado. Tente novamente.");
  try { return await commitImport(meta,parsed,franchiseId,userId); }
  catch (err) { await supabaseAdmin.storage.from("source-files").remove([meta.storage_path]); throw err; }
}
export async function associateStoredFile(fileId: string, franchiseId: string, userId: string) {
  const { data: file, error } = await supabaseAdmin.from("uploaded_files").select("id,reference_month,storage_path,original_filename,franchise_id,detected_raw_name").eq("id",fileId).single();
  if (error || !file) throw new Error("Arquivo não encontrado.");
  if (file.franchise_id) throw new Error("Este arquivo já foi associado. Atualize a lista.");
  if (!file.storage_path.endsWith(".sanitized.json")) throw new Error("Reenvie este arquivo para aplicar o tratamento seguro.");
  const { data: blob, error: downloadError } = await supabaseAdmin.storage.from("source-files").download(file.storage_path);
  if (downloadError || !blob) throw new Error("Não foi possível recuperar o arquivo tratado.");
  const parsed = JSON.parse(await blob.text()) as ParsedImport;
  if (parsed.version !== 1) throw new Error("Versão de arquivo não reconhecida. Reenvie o arquivo.");
  if (parsed.detected_raw_name) {
    const { data: alias, error: aliasError } = await supabaseAdmin.from("franchise_name_aliases").select("franchise_id").eq("raw_name_normalized",normalizeName(parsed.detected_raw_name)).maybeSingle();
    if (aliasError) throw new Error("Não foi possível conferir a equivalência.");
    if (alias && alias.franchise_id !== franchiseId) throw new Error("Este nome já pertence a outra franquia.");
  }
  return commitImport(file,parsed,franchiseId,userId,true);
}