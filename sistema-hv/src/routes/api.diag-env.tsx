import { createFileRoute } from "@tanstack/react-router";

// DIAGNÓSTICO TEMPORÁRIO — confere quais variáveis o RUNTIME enxerga (só
// presença + tamanho, nunca o valor). Protegido por ?k=. REMOVER após uso.
export const Route = createFileRoute("/api/diag-env")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("k") !== "orion-diag-9x7q") {
          return new Response("Forbidden", { status: 403 });
        }
        const names = [
          "GOOGLE_OAUTH_CLIENT_ID",
          "GOOGLE_OAUTH_CLIENT_SECRET",
          "GOOGLE_OAUTH_REFRESH_TOKEN",
          "GOOGLE_SERVICE_ACCOUNT_EMAIL",
          "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
          "GOOGLE_DRIVE_ROOT_FOLDER_ID",
          "SUPABASE_SERVICE_ROLE_KEY",
          "VITE_SUPABASE_URL",
        ];
        const env: Record<string, { present: boolean; len: number }> = {};
        for (const n of names) {
          const v = process.env[n];
          env[n] = { present: !!v, len: v ? v.length : 0 };
        }
        return new Response(JSON.stringify({ ok: true, env }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
