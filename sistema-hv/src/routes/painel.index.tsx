import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/painel/")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Painel"}]}
      eyebrow="Painel Executivo"
      title="Painel Executivo"
      subtitle="Visão consolidada para associados."
    />
  ),
});
