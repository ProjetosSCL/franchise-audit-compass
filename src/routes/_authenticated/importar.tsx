import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { UploadCloud, FileSpreadsheet, LoaderCircle, X, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getImportState, ingestMonthFiles, associateFileFranchise } from "@/lib/import.functions";
import type { ImportResult } from "@/lib/import-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const importOptions = (month:string) => queryOptions({queryKey:["imports",month],queryFn:() => getImportState({data:{month:`${month}-01`}})});

export const Route = createFileRoute("/_authenticated/importar")({
  validateSearch: (search:Record<string,unknown>):{month?:string} => typeof search["month"] === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(search["month"]) ? {month:search["month"]} : {},
  loaderDeps: ({search}) => ({month:search.month ?? currentMonth()}),
  loader: ({context,deps}) => context.queryClient.ensureQueryData(importOptions(deps.month)),
  head: () => ({
    meta: [
      { title: "Importar — SCL Audit" },
      {
        name: "description",
        content: "Upload dos arquivos do mês (Workinfinity e Stone).",
      },
      { property: "og:title", content: "Importar — SCL Audit" },
      {
        property: "og:description",
        content: "Upload dos arquivos do mês (Workinfinity e Stone).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Importar,
});

function Importar() {
  const { month } = Route.useLoaderDeps();
  const { data } = useSuspenseQuery(importOptions(month));
  const navigate = useNavigate({from:Route.fullPath});
  const queryClient = useQueryClient();
  const ingest = useServerFn(ingestMonthFiles);
  const associate = useServerFn(associateFileFranchise);
  const input = useRef<HTMLInputElement>(null);
  const [files,setFiles] = useState<File[]>([]);
  const [busy,setBusy] = useState(false);
  const [associating,setAssociating] = useState<string|null>(null);
  const [active,setActive] = useState("");
  const [done,setDone] = useState(0);
  const [errors,setErrors] = useState<{original_filename:string;message:string}[]>([]);
  const [recent,setRecent] = useState<ImportResult[]>([]);
  const [choices,setChoices] = useState<Record<string,string>>({});
  const [dragging,setDragging] = useState(false);
  const results = [...recent,...data.results.filter(r => !recent.some(n => n.uploaded_file_id === r.uploaded_file_id))];
  function addFiles(incoming:File[]) {
    const valid = incoming.filter(f => /\.(csv|xlsx)$/i.test(f.name));
    if (valid.length !== incoming.length) toast.error("Envie apenas arquivos CSV ou XLSX.");
    setFiles(old => [...old,...valid.filter(f => !old.some(o => o.name === f.name && o.size === f.size))]);
  }
  async function refresh() { await Promise.all([queryClient.invalidateQueries({queryKey:["imports"]}),queryClient.invalidateQueries({queryKey:["dashboard"]})]); }
  async function submit() {
    setBusy(true);setErrors([]);setDone(0);
    const succeeded:File[]=[];
    try {
      // Sequential requests keep each raw file transient and show honest per-file progress.
      for (const file of files) {
        setActive(file.name);
        const payload=new FormData();payload.append("reference_month",`${month}-01`);payload.append("files",file);
        try { const res=await ingest({data:payload});setRecent(old => [...res.results,...old]);setErrors(old => [...old,...res.errors]);if (!res.errors.length) succeeded.push(file); }
        catch { setErrors(old => [...old,{original_filename:file.name,message:"Não foi possível importar. Tente novamente."}]); }
        setDone(n => n+1);
      }
      setFiles(old => old.filter(f => !succeeded.includes(f)));await refresh();
    } finally {setBusy(false);setActive("");}
  }
  async function associateFile(result:ImportResult) {
    const franchiseId=choices[result.uploaded_file_id];if (!franchiseId) return;
    setAssociating(result.uploaded_file_id);
    try {const updated=await associate({data:{uploaded_file_id:result.uploaded_file_id,franchise_id:franchiseId}});setRecent(old => [updated,...old.filter(r => r.uploaded_file_id!==updated.uploaded_file_id)]);await refresh();toast.success("Franquia associada e arquivo importado.");}
    catch(e) {toast.error(e instanceof Error ? e.message : "Não foi possível associar o arquivo.");}
    finally {setAssociating(null);}
  }
  const money = (n:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Importar mês</h1><p className="mt-1 text-sm text-muted-foreground">Workinfinity · Stone / Ton</p></div>
        <div className="space-y-2"><Label htmlFor="reference-month">Mês de referência</Label><Input id="reference-month" type="month" value={month} disabled={busy || Boolean(associating)} onChange={e => {if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) {setRecent([]);setErrors([]);void navigate({search:{month:e.target.value}});}}} /></div>
      </div>
      <section className="border-t pt-6">
        <div className={`flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 ${dragging ? "border-primary bg-accent" : "border-border"}`} onDragOver={e => {e.preventDefault();if (!busy)setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={e => {e.preventDefault();setDragging(false);if (!busy)addFiles(Array.from(e.dataTransfer.files));}}>
          <UploadCloud className="h-9 w-9 text-muted-foreground" />
          <p className="font-medium">Arquivos do mês</p>
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><FileSpreadsheet className="h-4 w-4" />Selecionar arquivos</Button>
          <input ref={input} aria-label="Arquivos CSV e XLSX" type="file" multiple accept=".csv,.xlsx" className="sr-only" disabled={busy} onChange={e => {addFiles(Array.from(e.target.files ?? []));e.target.value="";}} />
        </div>
        {files.length > 0 && <ul className="mt-4 divide-y">{files.map((f,i) => <li key={`${f.name}-${i}`} className="flex items-center gap-3 py-3"><FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 break-all text-sm">{f.name}</span><span className="text-xs text-muted-foreground">{(f.size/1024).toFixed(0)} KB</span><Button aria-label={`Remover ${f.name}`} title="Remover arquivo" variant="ghost" size="icon" disabled={busy} onClick={() => setFiles(old => old.filter((_,n) => n !== i))}><X className="h-4 w-4" /></Button></li>)}</ul>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{busy ? `${done} / ${files.length} · ${active}` : `${files.length} arquivo(s) selecionado(s)`}</span><Button disabled={!files.length || busy || Boolean(associating)} onClick={submit}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{busy ? "Importando…" : "Importar mês"}</Button></div>
      </section>
      {errors.map((e,i) => <Alert variant="destructive" key={i}><AlertDescription><span className="font-medium break-all">{e.original_filename}</span><p>{e.message}</p></AlertDescription></Alert>)}
      <section className="border-t pt-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Arquivos importados</h2><Button variant="ghost" size="icon" aria-label="Atualizar importações" title="Atualizar importações" disabled={busy} onClick={refresh}><RefreshCw className="h-4 w-4" /></Button></div>
        {!results.length ? <p className="py-6 text-sm text-muted-foreground">Nenhum arquivo importado para este mês.</p> : <div className="space-y-4">{results.map(r => <article key={r.uploaded_file_id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-all font-medium">{r.original_filename}</h3><p className="mt-1 text-sm text-muted-foreground">{r.file_kind === "stone_xlsx" ? "Stone / Ton · XLSX" : "Workinfinity · CSV"} · {r.row_count} linhas</p></div><Badge variant={r.needs_manual_association ? "outline" : "secondary"}>{r.needs_manual_association ? "Associação pendente" : "Importado"}</Badge></div>
          <p className="mt-3 text-sm">{data.franchises.find(f => f.id===r.franchise_id)?.display_name ?? r.detected_raw_name ?? "Nome de franquia não encontrado"}</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span className="text-muted-foreground">Dados pessoais descartados</span>{r.file_kind === "stone_xlsx" && <><span>{r.realigned_rows_count} linhas realinhadas</span><span className={r.total_validation_diff ? "font-medium text-destructive" : "text-muted-foreground"}>Diferença de validação: {r.total_validation_diff === null ? "—" : money(r.total_validation_diff)}</span></>}</div>
          {r.needs_manual_association && <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"><div className="min-w-0 flex-1 space-y-2"><Label>Associar franquia</Label><Select value={choices[r.uploaded_file_id] ?? ""} onValueChange={v => setChoices(old => ({...old,[r.uploaded_file_id]:v}))} disabled={busy || Boolean(associating)}><SelectTrigger aria-label={`Franquia de ${r.original_filename}`}><SelectValue placeholder="Selecionar franquia" /></SelectTrigger><SelectContent>{data.franchises.map(f => <SelectItem key={f.id} value={f.id}>{f.display_name}</SelectItem>)}</SelectContent></Select></div><Button disabled={!choices[r.uploaded_file_id] || busy || Boolean(associating)} onClick={() => associateFile(r)}>{associating===r.uploaded_file_id && <LoaderCircle className="h-4 w-4 animate-spin" />}Associar e importar</Button></div>}
        </article>)}</div>}
      </section>
      <Button asChild variant="outline"><Link to="/" search={{month}}><ArrowLeft className="h-4 w-4" />Voltar ao Painel</Link></Button>
    </div>
  );
}
