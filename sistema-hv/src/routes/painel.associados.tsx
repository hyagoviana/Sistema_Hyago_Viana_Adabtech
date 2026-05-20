import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/painel/associados")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Painel","to":"/painel"},{"label":"Associados"}]}
      eyebrow="Painel"
      title="Associados"
      subtitle="Lista executiva de profissionais representados."
    />
  ),
});
