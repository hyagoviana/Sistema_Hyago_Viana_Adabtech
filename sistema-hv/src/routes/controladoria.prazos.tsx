import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/controladoria/prazos")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Controladoria","to":"/controladoria"},{"label":"Prazos"}]}
      eyebrow="Controladoria"
      title="Gestão de Prazos"
      subtitle="12 prazos nos próximos 7 dias."
    />
  ),
});
