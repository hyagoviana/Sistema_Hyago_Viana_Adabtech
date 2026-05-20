import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/comercial/leads")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Comercial","to":"/comercial"},{"label":"Leads"}]}
      eyebrow="Comercial"
      title="Lista de Leads"
      subtitle="Todos os leads captados nas últimas 30 dias."
    />
  ),
});
