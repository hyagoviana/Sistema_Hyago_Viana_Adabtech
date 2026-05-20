import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/marketing/")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Marketing"}]}
      eyebrow="Inteligência"
      title="Marketing"
      subtitle="Conteúdos, calendário editorial e banco de mídia."
    />
  ),
});
