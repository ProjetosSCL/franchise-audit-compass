import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/tendencia")({
  head: () => ({
    meta: [
      { title: "Tendência — SCL Audit" },
      {
        name: "description",
        content: "Evolução mês a mês dos indicadores de auditoria.",
      },
      { property: "og:title", content: "Tendência — SCL Audit" },
      {
        property: "og:description",
        content: "Evolução mês a mês dos indicadores de auditoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Tendencia,
});

function Tendencia() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tendência</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Série histórica
          </CardTitle>
          <CardDescription>
            Os gráficos de % do valor base retido, valor em risco, quantidade
            de OS e retenção por regra (Recharts) serão habilitados na Fase 2,
            após os primeiros meses importados.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Com menos de 2 meses de histórico não há série para exibir. Importe
          mais meses para acompanhar a tendência.
        </CardContent>
      </Card>
    </div>
  );
}
