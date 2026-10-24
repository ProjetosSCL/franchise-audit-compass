import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, RefreshCw, UploadCloud } from "lucide-react";
import { getDashboard } from "@/lib/dashboard.functions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel — SCL Audit" },
      {
        name: "description",
        content: "Visão consolidada do mês de referência por franquia.",
      },
      { property: "og:title", content: "Painel — SCL Audit" },
      {
        property: "og:description",
        content: "Visão consolidada do mês de referência por franquia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  processed: "Processado",
  error: "Erro",
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonthLabel(month: string): string {
  const parts = month.split("-");
  const year = Number(parts[0]);
  const m = Number(parts[1]);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, m - 1, 1));
}

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function Painel() {
  const dashboardFn = useServerFn(getDashboard);
  const [month, setMonth] = useState(currentMonth);
  const months = useMemo(() => lastMonths(12), []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardFn(),
  });

  const franchises = data?.franchises ?? [];
  const periodsForMonth = (data?.periods ?? []).filter(
    (p) => p.reference_month.slice(0, 7) === month,
  );

  const totalBase = periodsForMonth.reduce((s, p) => s + Number(p.total_valor_base ?? 0), 0);
  const totalPago = periodsForMonth.reduce((s, p) => s + Number(p.total_valor_pago ?? 0), 0);
  const totalDiff = periodsForMonth.reduce((s, p) => s + Number(p.total_difference ?? 0), 0);
  const openFindings = periodsForMonth.reduce((s, p) => s + (p.open_findings_count ?? 0), 0);
  const valueAtRisk = periodsForMonth.reduce((s, p) => s + Number(p.value_at_risk ?? 0), 0);
  const hasAnyPeriod = periodsForMonth.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link to="/importar">
            <UploadCloud className="mr-2 h-4 w-4" />
            Importar mês
          </Link>
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar o painel</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error instanceof Error ? error.message : "Tente novamente."}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Valor base", value: formatBRL(totalBase) },
          { label: "Valor pago", value: formatBRL(totalPago) },
          { label: "Diferença", value: formatBRL(totalDiff) },
          { label: "Achados abertos", value: hasAnyPeriod ? String(openFindings) : "0" },
          { label: "Valor em risco", value: formatBRL(valueAtRisk) },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{item.value}</CardTitle>
            </CardHeader>
            <CardContent className="sr-only" />
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {!hasAnyPeriod ? (
            <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Nenhuma apuração importada para {formatMonthLabel(month)}.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {franchises.map((franchise) => {
              const period = periodsForMonth.find((p) => p.franchise_id === franchise.id);
              return (
                <Link
                  key={franchise.id}
                  to="/franquia/$franchiseId/$month"
                  params={{ franchiseId: franchise.id, month }}
                  className="block rounded-lg outline-none focus-visible:ring-2"
                >
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{franchise.display_name}</CardTitle>
                        <Badge
                          variant={period?.status === "error" ? "destructive" : "secondary"}
                        >
                          {period ? STATUS_LABELS[period.status] ?? period.status : "Não importado"}
                        </Badge>
                      </div>
                      <CardDescription>{franchise.code}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm tabular-nums">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor base</span>
                        <span>{formatBRL(period?.total_valor_base)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor pago</span>
                        <span>{formatBRL(period?.total_valor_pago)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Diferença</span>
                        <span>{formatBRL(period?.total_difference)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Achados abertos</span>
                        <span>{period?.open_findings_count ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor em risco</span>
                        <span>{formatBRL(period?.value_at_risk)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
