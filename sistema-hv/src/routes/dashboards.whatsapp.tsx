import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/dashboards/whatsapp")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Dashboards","to":"/dashboards"},{"label":"WhatsApp"}]}
      eyebrow="Dashboards"
      title="WhatsApp"
      subtitle="Volume, classificação IA, SLA atendimento."
    />
  ),
});
