import { createFileRoute } from "@tanstack/react-router";

import { syncAsaasPagamentos } from "@/lib/asaas/service";

// Cron DIÁRIO (09:00 BRT = 12:00 UTC — ver `vercel.json` → crons "0 12 * * *").
// Fallback: consulta a API do Asaas para baixar parcelas que o webhook não pegou.
export const Route = createFileRoute("/api/cron/sync-asaas")({
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
          const result = await syncAsaasPagamentos();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("cron/sync-asaas:", err);
          return new Response(
            JSON.stringify({ ok: false, error: "erro interno no sync" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
