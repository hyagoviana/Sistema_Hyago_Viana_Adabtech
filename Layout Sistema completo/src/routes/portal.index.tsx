import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/portal/")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Portal"}]}
      eyebrow="Portal do Cliente"
      title="Olá, Dr. João"
      subtitle="Seu painel de acompanhamento."
    />
  ),
});
