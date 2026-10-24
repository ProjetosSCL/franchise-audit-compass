import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/franquia/$franchiseId/$month")({
  head: () => ({
    meta: [
      { title: "Detalhe da franquia — SCL Audit" },
      {
        name: "description",
        content: "Auditoria completa de uma franquia no mês de referência.",
      },
      { property: "og:title", content: "Detalhe da franquia — SCL Audit" },
      {
        property: "og:description",
        content: "Auditoria completa de uma franquia no mês de referência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FranquiaDetalhe,
});

function FranquiaDetalhe() {
  const { franchiseId, month } = Route.useParams();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Detalhe da franquia
          </h1>
          <p className="text-sm text-muted-foreground">
            Franquia {franchiseId} · {month}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao Painel</Link>
        </Button>
      </div>
      <section className="border-t py-16 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma apuração disponível para este período.</p>
      </section>
    </div>
  );
}
