import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/whatsapp/agente")({
  component: () => (
    <StubPage
      crumbs={[{"label":"WhatsApp","to":"/whatsapp"},{"label":"Agente IA"}]}
      eyebrow="WhatsApp"
      title="Configuração do Agente IA"
      subtitle="Prompts, classificações e regras de roteamento."
    />
  ),
});
