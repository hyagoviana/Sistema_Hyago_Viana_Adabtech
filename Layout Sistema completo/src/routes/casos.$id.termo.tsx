import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/casos/$id/termo")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Casos","to":"/casos"},{"label":"Termo"}]}
      eyebrow="Caso"
      title="Termo de Acerto"
      subtitle="Versão 3 · Vigente · FIES ESF."
    />
  ),
});
