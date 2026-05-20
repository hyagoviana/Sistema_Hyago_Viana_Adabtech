import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/controladoria/decisoes")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Controladoria","to":"/controladoria"},{"label":"Decisões"}]}
      eyebrow="Controladoria"
      title="Base de Decisões"
      subtitle="Decisões favoráveis catalogadas por tribunal e área."
    />
  ),
});
