import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/comercial/oportunidades")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Comercial","to":"/comercial"},{"label":"Oportunidades"}]}
      eyebrow="Comercial"
      title="Cross-sell · Oportunidades"
      subtitle="Oportunidades detectadas em clientes ativos."
    />
  ),
});
