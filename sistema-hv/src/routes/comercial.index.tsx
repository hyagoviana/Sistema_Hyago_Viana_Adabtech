import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/comercial/")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Comercial"}]}
      eyebrow="Inteligência"
      title="Comercial · CRM"
      subtitle="47 leads ativos · 32% conversão · LTV médio R$ 38K."
    />
  ),
});
