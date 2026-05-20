import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/marketing/banco-midia")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Marketing","to":"/marketing"},{"label":"Banco de mídia"}]}
      eyebrow="Marketing"
      title="Banco de Mídia"
      subtitle="Fotos, vídeos, áudios e templates."
    />
  ),
});
