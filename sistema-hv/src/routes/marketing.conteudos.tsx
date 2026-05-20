import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/marketing/conteudos")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Marketing","to":"/marketing"},{"label":"Conteúdos"}]}
      eyebrow="Marketing"
      title="Conteúdos"
      subtitle="Gerenciar todos os conteúdos em produção."
    />
  ),
});
