import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela de login unificada em /login. /entrar passou a redirecionar para evitar
// duas telas divergentes (decisão da Repaginada Premium — 2026-06-02).
export const Route = createFileRoute("/entrar")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
