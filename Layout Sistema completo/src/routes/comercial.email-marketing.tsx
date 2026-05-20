import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/comercial/email-marketing")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Comercial","to":"/comercial"},{"label":"E-mail"}]}
      eyebrow="Comercial"
      title="E-mail Marketing"
      subtitle="Campanhas, automações e métricas de engajamento."
    />
  ),
});
