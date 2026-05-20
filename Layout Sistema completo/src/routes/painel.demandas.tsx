import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/painel/demandas")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Painel","to":"/painel"},{"label":"Demandas"}]}
      eyebrow="Painel"
      title="Demandas Representadas"
      subtitle="Distribuição por tipo de causa."
    />
  ),
});
