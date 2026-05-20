import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/dashboards/comercial")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Dashboards","to":"/dashboards"},{"label":"Comercial"}]}
      eyebrow="Dashboards"
      title="Comercial"
      subtitle="Funil, conversão, LTV, CAC."
    />
  ),
});
