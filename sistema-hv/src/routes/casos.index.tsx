import { createFileRoute, redirect } from "@tanstack/react-router";

// A pipeline operacional agora é POR TIPO de serviço (cada tipo tem suas etapas,
// conforme os POPs). A esteira dinâmica vive em /pipeline (seleção de tipo →
// Kanban com as etapas do tipo). Esta rota antiga (board único hardcoded) passa
// a redirecionar para lá, evitando uma visão que mistura tipos.
export const Route = createFileRoute("/casos/")({
  beforeLoad: () => {
    throw redirect({ to: "/pipeline" });
  },
});
