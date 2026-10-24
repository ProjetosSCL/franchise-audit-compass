import { createFileRoute } from "@tanstack/react-router";

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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <section className="border-t py-16 text-center">
        <p className="text-sm text-muted-foreground">Configurações em preparação.</p>
      </section>
    </div>
  );
}
