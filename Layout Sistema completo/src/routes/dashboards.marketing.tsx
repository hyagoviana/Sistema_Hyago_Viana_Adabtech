import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/dashboards/marketing")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Dashboards","to":"/dashboards"},{"label":"Marketing"}]}
      eyebrow="Dashboards"
      title="Marketing"
      subtitle="Alcance, leads gerados, ROI por canal."
    />
  ),
});
