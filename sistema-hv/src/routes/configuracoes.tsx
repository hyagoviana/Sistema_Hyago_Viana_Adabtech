import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/configuracoes")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Configurações"}]}
      eyebrow="Sistema"
      title="Configurações"
      subtitle="Usuários, permissões, integrações, faturamento."
    />
  ),
});
