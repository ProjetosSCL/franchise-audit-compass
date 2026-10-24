import { createFileRoute } from "@tanstack/react-router";

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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Tendência</h1>
      <section className="border-t py-16 text-center">
        <p className="text-sm text-muted-foreground">Nenhum histórico disponível.</p>
      </section>
    </div>
  );
}
