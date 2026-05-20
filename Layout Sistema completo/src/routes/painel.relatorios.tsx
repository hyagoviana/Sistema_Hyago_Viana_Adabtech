import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/painel/relatorios")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Painel","to":"/painel"},{"label":"Relatórios"}]}
      eyebrow="Painel"
      title="Relatórios"
      subtitle="PDFs trimestrais e anuais para download."
    />
  ),
});
