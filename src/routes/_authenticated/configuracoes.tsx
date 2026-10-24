import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — SCL Audit" },
      {
        name: "description",
        content: "Equivalência de nomes, tabela de preços e regras de auditoria.",
      },
      { property: "og:title", content: "Configurações — SCL Audit" },
      {
        property: "og:description",
        content: "Equivalência de nomes, tabela de preços e regras de auditoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Equivalência de nomes, tabela de preços e regras
          </CardTitle>
          <CardDescription>
            As seções de equivalência de nomes (franchise_name_aliases),
            tabela de preços (price_table_entries) e o liga/desliga das 9
            regras de auditoria serão habilitadas na Fase 2.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          As 9 regras já estão cadastradas no banco (seed 1–9) e podem ser
          alternadas aqui a partir da Fase 2.
        </CardContent>
      </Card>
    </div>
  );
}
