import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/marketing/calendario")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Marketing","to":"/marketing"},{"label":"Calendário"}]}
      eyebrow="Marketing"
      title="Calendário Editorial"
      subtitle="Visão mensal por canal."
    />
  ),
});
