import { createFileRoute } from "@tanstack/react-router";
import { UploadCloud } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/importar")({
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
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Importar</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" />
            Upload dos arquivos do mês
          </CardTitle>
          <CardDescription>
            Esta tela será habilitada na Fase 2: upload múltiplo dos CSVs do
            Workinfinity (Latin-1, separador “;”) e dos XLSX da Stone (4 abas),
            descarte de PII (LGPD), realinhamento das linhas “Sem Retorno” e
            processamento das 9 regras de auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Enquanto isso, o Painel já mostra as 8 franquias e o seletor de mês de
          referência.
        </CardContent>
      </Card>
    </div>
  );
}
