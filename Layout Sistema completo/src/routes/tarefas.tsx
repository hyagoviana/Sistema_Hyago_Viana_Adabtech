import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/tarefas")({
  component: () => (
    <StubPage
      crumbs={[{"label":"Tarefas"}]}
      eyebrow="Operação"
      title="Central de tarefas"
      subtitle="24 minhas · 87 da equipe · 143 concluídas."
    />
  ),
});
