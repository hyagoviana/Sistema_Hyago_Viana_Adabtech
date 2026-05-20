import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/portal/mensagens")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Portal","to":"/portal"},{"label":"Mensagens"}]}
      eyebrow="Portal"
      title="Mensagens"
      subtitle="Converse com seu atendente."
    />
  ),
});
