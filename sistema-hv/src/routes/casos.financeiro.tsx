import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout pai de /casos/financeiro — só repassa para a rota filha (index = Kanban,
// inadimplencia = tela de inadimplência). Sem este layout, o gerador do TanStack
// não cria o pai virtual e a rota filha não resolve.
export const Route = createFileRoute("/casos/financeiro")({
  component: () => <Outlet />,
});
