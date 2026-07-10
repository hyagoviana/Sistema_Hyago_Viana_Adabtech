import { createFileRoute } from "@tanstack/react-router";

import { syncContaAzulPagamentos } from "@/lib/contaazul/service";

// Cron DIÁRIO (08:30 BRT = 11:30 UTC — ver `vercel.json` → crons "30 11 * * *").
// A Vercel invoca esta rota via GET com o header `Authorization: Bearer $CRON_SECRET`
// (setar CRON_SECRET nas envs da Vercel protege contra chamadas externas).
//
// Também dá pra disparar manualmente no navegador (GET) — se CRON_SECRET estiver
// setado, o disparo manual precisa do mesmo header/segredo.
export const Route = createFileRoute("/api/cron/sync-contaazul")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret) {
          const auth = request.headers.get("authorization");
          if (auth !== `Bearer ${secret}`) {
            return new Response("Forbidden", { status: 403 });
          }
        }

        try {
          const result = await syncContaAzulPagamentos();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("cron/sync-contaazul:", err);
          // 200 mesmo em erro (o cron não deve entrar em retentativa infinita).
          return new Response(
            JSON.stringify({ ok: false, error: "erro interno no sync" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
