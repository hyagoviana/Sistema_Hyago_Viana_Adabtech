import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/painel/resultados")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Painel","to":"/painel"},{"label":"Resultados"}]}
      eyebrow="Painel"
      title="Resultados"
      subtitle="Wall of fame · cases de sucesso."
    />
  ),
});
