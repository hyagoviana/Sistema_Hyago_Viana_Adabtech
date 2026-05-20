import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/dashboards/operacional")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Dashboards","to":"/dashboards"},{"label":"Operacional"}]}
      eyebrow="Dashboards"
      title="Operacional"
      subtitle="Tempos médios, gargalos, throughput."
    />
  ),
});
