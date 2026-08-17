import { createFileRoute } from "@tanstack/react-router";

import { runSync, ymd, isDistributionActive } from "@/lib/distribuicao/sync-core";

// Cron DIÁRIO do Motor de Distribuicao (08:00 BRT = 11:00 UTC — ver `vercel.json`
// → crons "0 11 * * *"). A Vercel invoca esta rota via GET com o header
// `Authorization: Bearer $CRON_SECRET` (setar CRON_SECRET nas envs da Vercel
// protege contra chamadas externas).
//
// Roda o MESMO nucleo do botao "Sincronizar" (runSync): LEITURA no ProJuris ->
// distributeBatch -> grava em system_distribution_results (+ batch_log). ZERO
// writeback ao ProJuris. Idempotente por data (re-sync limpo).
//
// Tambem da pra disparar manualmente no navegador (GET) — se CRON_SECRET estiver
// setado, o disparo manual precisa do mesmo header/segredo.
export const Route = createFileRoute("/api/cron/distribuicao")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // FAIL-CLOSED: sem CRON_SECRET setado, o endpoint NÃO roda (evita ficar
        // público disparando ProJuris + gravando em produção). A Vercel injeta o
        // header `Authorization: Bearer $CRON_SECRET` na chamada do cron.
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return new Response("CRON_SECRET nao configurado", { status: 403 });
        }
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${secret}`) {
          return new Response("Forbidden", { status: 403 });
        }

        try {
          // Gate de produção: só roda automático se o motor estiver LIGADO.
          if (!(await isDistributionActive())) {
            return new Response(JSON.stringify({ ok: true, skipped: "motor desligado" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          // Data = hoje (a Vercel roda em UTC; as 11:00 UTC ainda e o mesmo dia
          // civil no BRT). Janela de 3 dias cobre intimacoes recentes.
          const summary = await runSync(ymd(new Date()), 3);
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("cron/distribuicao:", err);
          // 200 mesmo em erro (o cron nao deve entrar em retentativa infinita).
          return new Response(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : "erro interno na distribuicao",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
