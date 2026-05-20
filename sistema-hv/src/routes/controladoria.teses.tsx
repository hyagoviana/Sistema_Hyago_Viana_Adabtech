import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/controladoria/teses")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Controladoria","to":"/controladoria"},{"label":"Teses"}]}
      eyebrow="Controladoria"
      title="Base de Teses"
      subtitle="Repositório curado de teses jurídicas reutilizáveis."
    />
  ),
});
