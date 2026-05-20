import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/peticionamento/$id")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Peticionamento","to":"/peticionamento"},{"label":"Editor"}]}
      eyebrow="Peticionamento"
      title="Editor de Minuta"
      subtitle="Editor rich-text com painel de IA e mapa de fontes."
    />
  ),
});
