import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFranchiseAudit, processAuditPeriod, updateFindingReview } from "@/lib/audit.functions";
import { brl, fmtDay, pct, REVIEW_LABEL, SEVERITY } from "@/lib/audit-format";

export const Route = createFileRoute("/_authenticated/franquia/$franchiseId/$month")({
  head: () => ({ meta: [{ title: "Detalhe da franquia — SCL Audit" }, { name: "description", content: "Auditoria completa de uma franquia no mês de referência." }] }),
  component: FranquiaDetalhe,
});

type Audit = Awaited<ReturnType<typeof getFranchiseAudit>>;
type Finding = Audit["findings"][number];
type ReviewStatus = "pendente" | "contestar" | "aceito";
const ROW_LIMIT = 300;

function monthLabel(m: string) {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "bad" }) {
  return (
    <Card><CardContent className="space-y-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tracking-tight ${tone === "bad" ? "text-destructive" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent></Card>
  );
}

function SeverityBadge({ value }: { value: string }) {
  const s = SEVERITY[value] ?? SEVERITY["low"]!;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function FindingsTable({ rows, onReview, busy }: { rows: Finding[]; onReview: (v: { id: string; review_status: ReviewStatus; observation?: string | null }) => void; busy: boolean }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum achado com estes filtros.</p>;
  return (
    <div className="space-y-2">
      <div className="max-h-[560px] overflow-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur"><TableRow>
            <TableHead>Prioridade</TableHead><TableHead>OS</TableHead><TableHead className="min-w-[280px]">Achado</TableHead>
            <TableHead>Técnico</TableHead><TableHead className="text-right">Valor estimado</TableHead><TableHead>Revisão</TableHead><TableHead className="min-w-[200px]">Observação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.slice(0, ROW_LIMIT).map((f) => (
              <TableRow key={f.id}>
                <TableCell><SeverityBadge value={f.severity} /></TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">{f.os ?? "—"}</TableCell>
                <TableCell><p className="text-sm font-medium">{f.title}</p>{f.detail && <p className="text-xs text-muted-foreground">{f.detail}</p>}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{f.tecnico ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(f.diferenca)}</TableCell>
                <TableCell>
                  <Select value={f.review_status} disabled={busy} onValueChange={(v) => onReview({ id: f.id, review_status: v as ReviewStatus })}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(REVIEW_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input className="h-8" defaultValue={f.observation ?? ""} placeholder="Observação" maxLength={2000}
                    onBlur={(e) => { if ((e.target.value ?? "") !== (f.observation ?? "")) onReview({ id: f.id, review_status: f.review_status as ReviewStatus, observation: e.target.value }); }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > ROW_LIMIT && <p className="text-xs text-muted-foreground">Mostrando {ROW_LIMIT} de {rows.length}. Use os filtros para refinar.</p>}
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/90"><TableRow>{head.map((h, i) => <TableHead key={h} className={i ? "text-right" : ""}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j ? "whitespace-nowrap text-right tabular-nums" : "whitespace-nowrap"}>{c}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
  );
}

function FranquiaDetalhe() {
  const { franchiseId, month } = Route.useParams();
  const qc = useQueryClient();
  const load = useServerFn(getFranchiseAudit);
  const review = useServerFn(updateFindingReview);
  const process = useServerFn(processAuditPeriod);
  const key = ["franchise-audit", franchiseId, month];
  const query = useQuery({ queryKey: key, queryFn: () => load({ data: { franchise_id: franchiseId, month } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const reviewMutation = useMutation({ mutationFn: (v: { id: string; review_status: ReviewStatus; observation?: string | null }) => review({ data: v }), onSuccess: refresh, onError: () => toast.error("Não foi possível salvar a revisão.") });
  const processMutation = useMutation({ mutationFn: (id: string) => process({ data: { audit_period_id: id } }), onSuccess: () => { toast.success("Auditoria processada."); refresh(); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível processar.") });

  const [ruleFilter, setRuleFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("actionable");
  const [statusFilter, setStatusFilter] = useState("all");
  const [text, setText] = useState("");
  const data = query.data;
  const findings = data?.findings ?? [];
  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return findings.filter((f) =>
      (ruleFilter === "all" || String(f.rule_id) === ruleFilter) &&
      (sevFilter === "all" ? true : sevFilter === "actionable" ? f.severity !== "info" : f.severity === sevFilter) &&
      (statusFilter === "all" || f.review_status === statusFilter) &&
      (!q || [f.os, f.title, f.detail, f.tecnico, f.grupo_servico].some((x) => x?.toLowerCase().includes(q))))
      .sort((a, b) => (SEVERITY[a.severity]?.rank ?? 9) - (SEVERITY[b.severity]?.rank ?? 9) || (b.diferenca ?? 0) - (a.diferenca ?? 0));
  }, [findings, ruleFilter, sevFilter, statusFilter, text]);
  const contest = useMemo(() => findings.filter((f) => f.review_status === "contestar"), [findings]);
  const open = findings.filter((f) => f.review_status === "pendente" || f.review_status === "contestar");
  const sumBy = (sev: string) => open.filter((f) => f.severity === sev).reduce((a, f) => a + (f.diferenca ?? 0), 0);

  const Header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data?.franchise.display_name ?? "Detalhe da franquia"}</h1>
        <p className="text-sm capitalize text-muted-foreground">{monthLabel(month)}</p>
      </div>
      <div className="flex gap-2">
        {data?.period && data.ready && (
          <Button variant="outline" disabled={processMutation.isPending} onClick={() => processMutation.mutate(data.period!.id)}>
            <RefreshCw className={`mr-2 h-4 w-4 ${processMutation.isPending ? "animate-spin" : ""}`} />Reprocessar
          </Button>
        )}
        <Button asChild variant="outline"><Link to="/" search={{ month }}>Voltar ao Painel</Link></Button>
      </div>
    </div>
  );

  if (query.isLoading) return <div className="mx-auto max-w-7xl space-y-6 p-6">{Header}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div></div>;
  if (query.isError || !data) return <div className="mx-auto max-w-7xl space-y-6 p-6">{Header}<div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">Não foi possível carregar a auditoria. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></div></div>;
  if (!data.period || !data.ready) {
    const have = [data.period?.stone_file_id && "apuração da Stone", data.period?.workinfinity_file_id && "relatório do Workinfinity"].filter(Boolean);
    return <div className="mx-auto max-w-7xl space-y-6 p-6">{Header}<section className="rounded-md border py-16 text-center">
      <p className="text-sm text-muted-foreground">{have.length ? `Falta importar o outro arquivo. Já importado: ${have.join(" e ")}.` : "Nenhuma apuração disponível para este período."}</p>
      <Button asChild className="mt-4"><Link to="/importar" search={{ month }}>Importar arquivos</Link></Button></section></div>;
  }

  const p = data.period, s = data.summary!;
  const needsProcess = p.status !== "processed";
  const recOk = s.reconciliation.validationDiff != null && Math.abs(s.reconciliation.validationDiff) < 0.02;
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {Header}
      {needsProcess && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span>{p.status === "error" ? "O último processamento falhou." : "As duas fontes foram importadas, mas a auditoria ainda não foi processada."}</span>
          <Button size="sm" disabled={processMutation.isPending} onClick={() => processMutation.mutate(p.id)}>Processar agora</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Chamados no Workinfinity" value={String(s.counts.workinfinity)} hint={`${s.counts.soWorkinfinity} sem OS na apuração`} />
        <Kpi label="OS na apuração" value={String(s.counts.stone)} hint={`${s.counts.baixadas} baixadas · ${s.counts.naoBaixadas} não baixadas`} />
        <Kpi label="Valor base" value={brl(s.reconciliation.base)} />
        <Kpi label="Valor pago" value={brl(s.reconciliation.pago)} />
        <Kpi label="Retido" value={brl(s.reconciliation.retido)} hint={`${pct(s.reconciliation.retido, s.reconciliation.base)} do valor base`} />
        <Kpi label="Valor em risco" value={brl(p.value_at_risk)} hint="Achados pendentes e a contestar" tone="bad" />
        <Kpi label="Achados abertos" value={String(p.open_findings_count)} hint={`${contest.length} marcados para contestar`} />
        <Kpi label="A contestar" value={brl(contest.reduce((a, f) => a + (f.diferenca ?? 0), 0))} />
      </div>
      <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${recOk ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"}`}>
        {recOk ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
        <span>
          {recOk ? `A soma do valor pago (${brl(s.reconciliation.pago)}) bate com Stone + Ton + Bobina do Consolidado.` : `A soma do valor pago difere do Consolidado em ${brl(s.reconciliation.validationDiff)}.`}
          {p.realigned_rows_count > 0 && ` ${p.realigned_rows_count} linha(s) da apuração estavam com colunas deslocadas e foram realinhadas.`}
        </span>
      </div>

      <Tabs defaultValue="achados">
        <TabsList className="flex-wrap">
          <TabsTrigger value="achados">Achados ({filtered.length})</TabsTrigger>
          <TabsTrigger value="contestar">A contestar ({contest.length})</TabsTrigger>
          <TabsTrigger value="resumos">Retenção e equipe</TabsTrigger>
          <TabsTrigger value="prazos">Prazos e cancelamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="achados" className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Buscar por OS, técnico, serviço…" value={text} onChange={(e) => setText(e.target.value)} />
            <Select value={ruleFilter} onValueChange={setRuleFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Todas as regras</SelectItem>{data.rules.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.id}. {r.name}</SelectItem>)}</SelectContent></Select>
            <Select value={sevFilter} onValueChange={setSevFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="actionable">Alta, média e baixa</SelectItem><SelectItem value="high">Só alta</SelectItem><SelectItem value="medium">Só média</SelectItem><SelectItem value="low">Só baixa</SelectItem><SelectItem value="info">Informativos</SelectItem><SelectItem value="all">Todas</SelectItem></SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Toda revisão</SelectItem>{Object.entries(REVIEW_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          </div>
          <p className="text-xs text-muted-foreground">Em aberto: alta {brl(sumBy("high"))} · média {brl(sumBy("medium"))} · baixa {brl(sumBy("low"))}. “Baixa” segue a regra da Stone e só vale contestar se o contrato disser outra coisa.</p>
          <FindingsTable rows={filtered} busy={reviewMutation.isPending} onReview={(v) => reviewMutation.mutate(v)} />
        </TabsContent>

        <TabsContent value="contestar" className="space-y-3">
          <p className="text-sm text-muted-foreground">Marque achados como “Contestar” na aba Achados; a lista para enviar à Stone, com exportação em XLSX, está em <Link to="/contestacao" search={{ month }} className="underline">Contestação</Link>.</p>
          <FindingsTable rows={contest} busy={reviewMutation.isPending} onReview={(v) => reviewMutation.mutate(v)} />
        </TabsContent>

        <TabsContent value="resumos" className="space-y-6">
          <Card><CardHeader><CardTitle className="text-base">De onde vem a diferença entre base e pago</CardTitle></CardHeader><CardContent>
            <SimpleTable head={["Motivo", "OS", "Valor retido"]} rows={[
              ["Regra de 40% (OS adicional na mesma visita)", s.decomposition.p40.n, brl(s.decomposition.p40.valor)],
              ["Auditoria: baixa tardia (pago zero)", s.decomposition.tardia.n, brl(s.decomposition.tardia.valor)],
              ["Multa por atraso", s.decomposition.multa.n, brl(s.decomposition.multa.valor)],
              ["Outros", s.decomposition.outros.n, brl(s.decomposition.outros.valor)]]} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Por técnico</CardTitle></CardHeader><CardContent>
            <SimpleTable head={["Técnico", "OS", "Baixadas", "Não baixadas", "Valor base", "Valor pago", "Retido", "% retido", "Baixa tardia"]}
              rows={s.byTechnician.map((g) => [g.key, g.n, g.baixadas, g.naoBaixadas, brl(g.base), brl(g.pago), brl(g.retido), pct(g.retido, g.base), g.tardia])} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Por produto e serviço</CardTitle></CardHeader><CardContent>
            <SimpleTable head={["Produto · Serviço", "OS", "Valor base", "Valor pago", "Retido", "% retido", "Prazo médio (dias)"]}
              rows={s.byService.map((g) => [g.key, g.n, brl(g.base), brl(g.pago), brl(g.retido), pct(g.retido, g.base), g.prazoMedio == null ? "—" : String(g.prazoMedio).replace(".", ",")])} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="prazos" className="space-y-6">
          <Card><CardHeader><CardTitle className="text-base">OS por dia de atendimento</CardTitle></CardHeader><CardContent>
            <div className="h-56 w-full"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.daily.map((d) => ({ dia: fmtDay(d.dia).slice(0, 5), n: d.n, pago: d.pago }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="dia" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={30} />
                <Tooltip formatter={(v) => [String(v), "OS"]} />
                <Bar dataKey="n" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart></ResponsiveContainer></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Cancelamentos e sem retorno</CardTitle></CardHeader><CardContent>
            <SimpleTable head={["Motivo", "OS", "Visitas", "Valor base", "Valor pago", "% pago"]}
              rows={s.byCancelReason.map((c) => [c.motivo, c.n, c.visitas, brl(c.base), brl(c.pago), pct(c.pago, c.base)])} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Atendimentos fora do prazo ({s.late.length})</CardTitle></CardHeader><CardContent>
            <SimpleTable head={["OS", "Técnico", "Data limite", "Atendida em", "Atraso (dias)", "Multa", "Abono", "Valor pago"]}
              rows={s.late.map((l) => [l.os, l.tecnico ?? "—", fmtDay(l.limite), fmtDay(l.atendida), l.diasAtraso, brl(l.multa), l.abono ? "Sim" : "Não", brl(l.pago)])} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
