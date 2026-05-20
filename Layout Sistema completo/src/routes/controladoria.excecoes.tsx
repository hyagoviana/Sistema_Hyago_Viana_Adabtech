import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/controladoria/excecoes")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Controladoria","to":"/controladoria"},{"label":"Exceções"}]}
      eyebrow="Controladoria"
      title="Centro de Exceções"
      subtitle="5 exceções abertas para resolução."
    />
  ),
});
