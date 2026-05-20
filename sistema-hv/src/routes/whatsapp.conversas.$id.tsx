import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/whatsapp/conversas/$id")({
  component: () => (
    <StubPage
      crumbs={[{"label":"WhatsApp","to":"/whatsapp"},{"label":"Conversa"}]}
      eyebrow="WhatsApp"
      title="Conversa"
      subtitle="Chat individual com painel de IA contextual."
    />
  ),
});
