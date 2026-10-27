import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getContestations } from "@/lib/audit.functions";
import { brl, fmtDay, SEVERITY } from "@/lib/audit-format";

const validMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const Route = createFileRoute("/_authenticated/contestacao")({
  validateSearch: (search: Record<string, unknown>): { month?: string } => (validMonth(search["month"]) ? { month: search["month"] } : {}),
  head: () => ({ meta: [{ title: "Contestação — SCL Audit" }, { name: "description", content: "Achados marcados para contestar e exportação por franquia." }] }),
  component: Contestacao,
});

function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
}

function Contestacao() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const months = useMemo(() => lastMonths(12), []);
  const month = search.month ?? months[0]!;
  const load = useServerFn(getContestations);
  const query = useQuery({ queryKey: ["contestations", month], queryFn: () => load({ data: { month } }) });
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof query.data>["items"]>();
    for (const it of query.data?.items ?? []) m.set(it.franchise, [...(m.get(it.franchise) ?? []), it]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [query.data]);

  const exportXlsx = (name: string, items: NonNullable<typeof query.data>["items"]) => {
    const rows = items.map((i) => ({ OS: i.os ?? "", Serviço: i.grupo_servico ?? "", Técnico: i.tecnico ?? "", "Data do atendimento": fmtDay(i.data_atendimento),
      "Valor base": i.valor_base_os ?? 0, "Valor pago": i.valor_pago ?? 0, "Valor estimado a recuperar": i.diferenca ?? 0, Prioridade: SEVERITY[i.severity]?.label ?? i.severity, Motivo: i.title, Detalhe: i.detail ?? "", Observação: i.observation ?? "" }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Contestação");
    XLSX.writeFile(book, `contestacao-${name.replace(/[^A-Za-z0-9]+/g, "-")}-${month}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contestação</h1>
        <Select value={month} onValueChange={(v) => navigate({ search: { month: v }, replace: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {query.isLoading && <Skeleton className="h-40" />}
      {query.isError && <p className="text-sm text-destructive">Não foi possível carregar as contestações. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
      {!query.isLoading && !query.isError && groups.length === 0 && (
        <section className="rounded-md border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum achado marcado como “Contestar” neste mês. Revise os achados no detalhe de cada franquia.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/" search={{ month }}>Ir ao Painel</Link></Button>
        </section>
      )}
      {groups.map(([name, items]) => (
        <Card key={name}>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">{name} · {items.length} item(ns) · {brl(items.reduce((a, i) => a + (i.diferenca ?? 0), 0))}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => exportXlsx(name, items)}><Download className="mr-2 h-4 w-4" />Baixar XLSX</Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto rounded-md border"><Table>
              <TableHeader className="sticky top-0 bg-muted/90"><TableRow><TableHead>OS</TableHead><TableHead>Motivo</TableHead><TableHead>Técnico</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Estimado</TableHead></TableRow></TableHeader>
              <TableBody>{items.map((i) => (
                <TableRow key={i.id}><TableCell className="font-mono text-xs">{i.os ?? "—"}</TableCell><TableCell><p className="text-sm">{i.title}</p>{i.observation && <p className="text-xs text-muted-foreground">{i.observation}</p>}</TableCell>
                  <TableCell className="text-xs">{i.tecnico ?? "—"}</TableCell><TableCell className="whitespace-nowrap text-xs">{fmtDay(i.data_atendimento)}</TableCell><TableCell className="text-right tabular-nums">{brl(i.diferenca)}</TableCell></TableRow>))}</TableBody>
            </Table></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
