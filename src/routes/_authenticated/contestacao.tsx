import { createFileRoute } from "@tanstack/react-router";

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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Contestação</h1>
      <section className="border-t py-16 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma contestação disponível.</p>
      </section>
    </div>
  );
}
