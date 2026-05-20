import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/portal/casos/$id")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Portal","to":"/portal"},{"label":"Caso"}]}
      eyebrow="Portal"
      title="Meu Caso"
      subtitle="Acompanhe o andamento em linguagem clara."
    />
  ),
});
