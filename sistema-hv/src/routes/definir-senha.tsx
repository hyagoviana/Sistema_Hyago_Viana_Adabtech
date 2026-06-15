import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada — redireciona para /nova-senha mantendo query params (code, etc.)
export const Route = createFileRoute("/definir-senha")({
  beforeLoad: ({ location }) => {
    throw redirect({ to: "/nova-senha", search: location.search });
  },
});
