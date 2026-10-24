import { createFileRoute } from "@tanstack/react-router";

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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Importar</h1>
      <section className="border-t py-16 text-center">
        <p className="text-sm text-muted-foreground">Nenhum arquivo importado.</p>
      </section>
    </div>
  );
}
