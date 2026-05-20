import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/peticionamento/")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Peticionamento"}]}
      eyebrow="Inteligência"
      title="Peticionamento"
      subtitle="Minutas, banco de peças e editor com IA."
    />
  ),
});
