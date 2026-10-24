import { createFileRoute } from "@tanstack/react-router";
import { FileOutput } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/contestacao")({
  head: () => ({
    meta: [
      { title: "Contestação — SCL Audit" },
      {
        name: "description",
        content: "Achados marcados para contestar e exportação por franquia.",
      },
      { property: "og:title", content: "Contestação — SCL Audit" },
      {
        property: "og:description",
        content: "Achados marcados para contestar e exportação por franquia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contestacao,
});

function Contestacao() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Contestação</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileOutput className="h-5 w-5" />
            Nenhum achado marcado para contestar
          </CardTitle>
          <CardDescription>
            A revisão de achados (Contestar / Aceito / Pendente) e a exportação
            de XLSX e PDF por franquia serão habilitadas na Fase 2, junto do
            processamento das 9 regras.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Após importar um mês, marque os achados no Detalhe da franquia e
          exporte aqui.
        </CardContent>
      </Card>
    </div>
  );
}
