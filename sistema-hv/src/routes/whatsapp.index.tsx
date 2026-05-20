import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/whatsapp/")({
  component: () => (
    <StubPage
      crumbs={[{"label":"WhatsApp"}]}
      eyebrow="Inteligência"
      title="WhatsApp · Inbox"
      subtitle="Conversas em tempo real com classificação por IA."
    />
  ),
});
