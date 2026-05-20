import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/dashboards/financeiro")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Dashboards","to":"/dashboards"},{"label":"Financeiro"}]}
      eyebrow="Dashboards"
      title="Financeiro"
      subtitle="Recebimentos, projeções, inadimplência."
    />
  ),
});
