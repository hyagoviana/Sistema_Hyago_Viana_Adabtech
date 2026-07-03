import { createFileRoute, useParams } from "@tanstack/react-router";

import { Breadcrumb } from "@/components/hv/primitives";
import { StubPage } from "@/components/hv/StubPage";
import { useCase } from "@/hooks/useCases";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { usePublishRouteTitle } from "@/lib/route-title";

export const Route = createFileRoute("/portal/casos/$id")({
  component: PortalCaso,
});

function PortalCaso() {
  const { id } = useParams({ from: "/portal/casos/$id" });
  const { data: caso, isLoading, isError } = useCase(id);

  // S4-06 — código do caso no breadcrumb e título, nunca UUID.
  const casoLabel = resolveEntityLabel(caso?.case_code, {
    loading: isLoading,
    notFound: isError,
    notFoundLabel: "Caso não encontrado",
  });
  useDocumentTitle(`${casoLabel} · Meu Caso`);
  // fix breadcrumb Topbar (2026-07-03) — publica o rótulo do caso p/ o Topbar.
  usePublishRouteTitle(casoLabel);

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Portal", to: "/portal" }, { label: casoLabel }]} />
      <StubPage
        crumbs={[]}
        eyebrow={`Portal · ${casoLabel}`}
        title="Meu Caso"
        subtitle="Acompanhe o andamento em linguagem clara."
      />
    </div>
  );
}
