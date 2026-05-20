import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/portal/documentos")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Portal","to":"/portal"},{"label":"Documentos"}]}
      eyebrow="Portal"
      title="Documentos"
      subtitle="Envie e acompanhe documentos solicitados."
    />
  ),
});
