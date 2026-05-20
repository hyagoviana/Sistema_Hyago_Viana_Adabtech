import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/portal/boletos")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Portal","to":"/portal"},{"label":"Boletos"}]}
      eyebrow="Portal"
      title="Boletos"
      subtitle="Visualize e pague seus boletos."
    />
  ),
});
