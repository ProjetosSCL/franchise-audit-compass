import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeName, validateMonth, type ImportResult } from "./import-types";

export const getImportState = createServerFn({method:"GET"}).middleware([requireSupabaseAuth])
  .inputValidator((input:{month:string}) => ({month:validateMonth(input.month)}))
  .handler(async ({data,context}) => {
    const [franchises,files,periods] = await Promise.all([
      context.supabase.from("franchises").select("id,display_name").eq("is_active",true).order("display_name"),
      context.supabase.from("uploaded_files").select("id,original_filename,file_kind,franchise_id,detected_raw_name,row_count").eq("reference_month",data.month).order("created_at",{ascending:false}).limit(200),
      context.supabase.from("audit_periods").select("id,franchise_id,stone_file_id,workinfinity_file_id,realigned_rows_count,total_validation_diff").eq("reference_month",data.month),
    ]);
    if (franchises.error || files.error || periods.error) throw new Error("Não foi possível carregar as importações.");
    const results:ImportResult[] = (files.data ?? []).map(file => {
      const period = periods.data?.find(p => p.stone_file_id === file.id || p.workinfinity_file_id === file.id);
      return {uploaded_file_id:file.id,original_filename:file.original_filename,file_kind:file.file_kind === "stone_xlsx" ? "stone_xlsx" : "workinfinity_csv",detected_raw_name:file.detected_raw_name,franchise_id:file.franchise_id,audit_period_id:period?.id ?? null,row_count:file.row_count ?? 0,realigned_rows_count:file.file_kind === "stone_xlsx" ? period?.realigned_rows_count ?? 0 : 0,total_validation_diff:file.file_kind === "stone_xlsx" ? period?.total_validation_diff ?? null : null,needs_manual_association:file.franchise_id === null};
    });
    return {franchises:franchises.data ?? [],results};
  });

// ingest-month-files: files arrive in memory; raw uploads never touch Storage.
export const ingestMonthFiles = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((input:FormData) => {
    if (!(input instanceof FormData)) throw new Error("Upload inválido.");
    validateMonth(String(input.get("reference_month")));
    const files = input.getAll("files");
    if (!files.length || files.some(f => typeof f === "string")) throw new Error("Selecione os arquivos.");
    return input;
  }).handler(async ({data,context}) => {
    const { parseImport } = await import("./import-parser.server");
    const { storeImport } = await import("./import-storage.server");
    const results:ImportResult[] = [];
    const errors:{original_filename:string;message:string}[] = [];
    const month = validateMonth(String(data.get("reference_month")));
    for (const entry of data.getAll("files")) {
      if (typeof entry === "string") continue;
      try {
        const parsed = parseImport(new Uint8Array(await entry.arrayBuffer()),entry.name);
        let franchiseId:string|null = null;
        if (parsed.detected_raw_name) {
          const { data:alias,error } = await context.supabase.from("franchise_name_aliases").select("franchise_id").eq("raw_name_normalized",normalizeName(parsed.detected_raw_name)).maybeSingle();
          if (error) throw new Error("Não foi possível consultar a equivalência de franquias.");
          franchiseId = alias?.franchise_id ?? null;
        }
        results.push(await storeImport(parsed,entry.name,month,context.userId,franchiseId));
      } catch (error) { errors.push({original_filename:entry.name,message:error instanceof Error ? error.message : "Não foi possível importar este arquivo."}); }
    }
    // Processa a auditoria quando o período já tem as duas fontes. Falha aqui não desfaz a importação.
    const periodIds = [...new Set(results.map(r => r.audit_period_id).filter((id): id is string => Boolean(id)))];
    if (periodIds.length) {
      const { processPeriodIfReady } = await import("./audit.server");
      for (const id of periodIds) { try { await processPeriodIfReady(id); } catch { console.error("Auditoria automática não concluída para o período", id); } }
    }
    return {results,errors};
  });

// associate-file-franchise: saves the alias and imports the trusted sanitized file.
export const associateFileFranchise = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator(z.object({uploaded_file_id:z.string().uuid(),franchise_id:z.string().uuid()}))
  .handler(async ({data,context}) => {
    const { associateStoredFile } = await import("./import-storage.server");
    return associateStoredFile(data.uploaded_file_id,data.franchise_id,context.userId);
  });