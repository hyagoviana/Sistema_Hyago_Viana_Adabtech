import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/casos/financeiro/inadimplencia")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Casos","to":"/casos"},{"label":"Financeiro"},{"label":"Inadimplência"}]}
      eyebrow="Financeiro"
      title="Inadimplência"
      subtitle="32 casos com parcelas em atraso. Total em aberto: R$ 184K."
    />
  ),
});
