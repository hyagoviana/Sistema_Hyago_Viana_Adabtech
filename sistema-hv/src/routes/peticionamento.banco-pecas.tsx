import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/peticionamento/banco-pecas")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Peticionamento","to":"/peticionamento"},{"label":"Banco de peças"}]}
      eyebrow="Peticionamento"
      title="Banco de Peças"
      subtitle="Peças validadas e reutilizáveis."
    />
  ),
});
