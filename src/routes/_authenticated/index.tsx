import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month) ? search.month : undefined,
  }),
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

function Painel() {
  const dashboardFn = useServerFn(getDashboard);
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const [initialMonth] = useState(currentMonth);
  const month = search.month ?? initialMonth;
  const months = useMemo(() => lastMonths(12), []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardFn(),
  });

  const franchises = data?.franchises ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-6">
          <h1 className="text-2xl font-semibold">Painel geral</h1>
          <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Mês de referência</p>
          <Select value={month} onValueChange={(value) => navigate({ search: { month: value }, replace: true })}>
            <SelectTrigger className="w-52" aria-label="Mês de referência">
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
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-medium">Franquias</h2>
            <span className="text-xs text-muted-foreground">{franchises.length} franquias · {formatMonthLabel(month)}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {franchises.map((franchise) => {
              return (
                <Link
                  key={franchise.id}
                  to="/franquia/$franchiseId/$month"
                  params={{ franchiseId: franchise.id, month }}
                  className="block rounded-lg outline-none focus-visible:ring-2"
                >
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">{franchise.display_name}</CardTitle>
                        <Badge variant="secondary">
                          Sem dados
                        </Badge>
                      </div>
                      <CardDescription>{franchise.code}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm tabular-nums">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor base</span>
                        <span>—</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor pago</span>
                        <span>—</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Diferença</span>
                        <span>—</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Achados abertos</span>
                        <span>—</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor em risco</span>
                        <span>—</span>
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
