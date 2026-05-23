import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/casos/$id/termo/elaborar")({
  component: () => (
    <StubPage
      crumbs={[{ label: "Casos", to: "/casos" }, { label: "Termo" }, { label: "Elaborar" }]}
      eyebrow="Caso · Termo"
      title="Elaborar Termo"
      subtitle="Wizard em 4 etapas para gerar termo de acerto."
    />
  ),
});
