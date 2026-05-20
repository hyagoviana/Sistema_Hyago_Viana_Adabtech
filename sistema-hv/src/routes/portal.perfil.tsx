import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/portal/perfil")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Portal","to":"/portal"},{"label":"Perfil"}]}
      eyebrow="Portal"
      title="Meu Perfil"
      subtitle="Atualize seus dados pessoais."
    />
  ),
});
