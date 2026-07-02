import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumb } from "@/components/hv/primitives";
import { StubPage } from "@/components/hv/StubPage";
import { useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/whatsapp/conversas/$id")({
  component: WhatsappConversa,
});

function WhatsappConversa() {
  // S4-06 — sem fonte de dados do contato ainda (tela stub). Título/breadcrumb
  // usam rótulo genérico "Conversa", NUNCA o UUID do param.
  useDocumentTitle("Conversa");

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "WhatsApp", to: "/whatsapp" }, { label: "Conversa" }]} />
      <StubPage
        crumbs={[]}
        eyebrow="WhatsApp"
        title="Conversa"
        subtitle="Chat individual com painel de IA contextual."
      />
    </div>
  );
}
