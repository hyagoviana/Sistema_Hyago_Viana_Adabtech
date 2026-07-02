import { createFileRoute, useParams } from "@tanstack/react-router";

import { Breadcrumb } from "@/components/hv/primitives";
import { StubPage } from "@/components/hv/StubPage";
import { useCase } from "@/hooks/useCases";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/casos/$id/termo/elaborar")({
  component: ElaborarTermo,
});

function ElaborarTermo() {
  const { id } = useParams({ from: "/casos/$id/termo/elaborar" });
  const { data: caso, isLoading, isError } = useCase(id);

  // S4-06 — nome do caso no breadcrumb e título, nunca UUID.
  const casoLabel = resolveEntityLabel(caso?.case_code, {
    loading: isLoading,
    notFound: isError,
    notFoundLabel: "Caso não encontrado",
  });
  useDocumentTitle(`${casoLabel} · Elaborar termo`);

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Casos", to: "/casos" },
          { label: casoLabel, to: `/casos/${id}` },
          { label: "Termo", to: `/casos/${id}/termo` },
          { label: "Elaborar" },
        ]}
      />
      <StubPage
        crumbs={[]}
        eyebrow={`Caso · ${casoLabel} · Termo`}
        title="Elaborar Termo"
        subtitle="Wizard em 4 etapas para gerar termo de acerto."
      />
    </div>
  );
}
