import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/comercial/funil")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Comercial","to":"/comercial"},{"label":"Funil"}]}
      eyebrow="Comercial"
      title="Funil de Vendas"
      subtitle="7 etapas do lead ao contrato."
    />
  ),
});
