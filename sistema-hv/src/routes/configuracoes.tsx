import { createFileRoute, Outlet } from "@tanstack/react-router";

// I1 (2026-08-05) — /configuracoes virou LAYOUT (Outlet) para hospedar a rota
// filha /configuracoes/campos-personalizados (tela dedicada de campos). O
// conteúdo antigo da tela de Configurações passou para configuracoes.index.tsx.
export const Route = createFileRoute("/configuracoes")({
  component: () => <Outlet />,
});
