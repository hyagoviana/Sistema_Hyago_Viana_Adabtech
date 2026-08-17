import { createFileRoute } from "@tanstack/react-router";

import { runSync, ymd, isDistributionActive } from "@/lib/distribuicao/sync-core";
import { syncContaAzulPagamentos } from "@/lib/contaazul/service";
import { syncAsaasPagamentos } from "@/lib/asaas/service";

// Cron DIÁRIO CONSOLIDADO (08:00 BRT = 11:00 UTC — ver `vercel.json`).
//
// POR QUE UM SÓ: o plano Hobby da Vercel permite no máximo 2 cron jobs. Havia 3
// (distribuição + contaazul + asaas). Este dispatcher roda os 3 em sequência a
// partir de um único agendamento, sem exigir upgrade de plano. Cada job é
// isolado num try/catch — a falha de um não derruba os outros.
//
// SEGURANÇA:
//   - FAIL-CLOSED: sem CRON_SECRET setado, não roda (evita endpoint público que
//     dispara ProJuris + grava em produção).
//   - Distribuição só roda se o motor estiver LIGADO (config.active).
//   - ZERO writeback ao ProJuris (runSync só grava no nosso banco).
export const Route = createFileRoute("/api/cron/daily")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return new Response("CRON_SECRET nao configurado", { status: 403 });
        }
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${secret}`) {
          return new Response("Forbidden", { status: 403 });
        }

        const result: Record<string, unknown> = { ok: true };

        // 1) Motor de Distribuição (só se ligado). LEITURA no ProJuris.
        try {
          if (await isDistributionActive()) {
            result.distribuicao = await runSync(ymd(new Date()), 3);
          } else {
            result.distribuicao = { skipped: "motor desligado" };
          }
        } catch (err) {
          console.error("cron/daily:distribuicao:", err);
          result.distribuicao = {
            ok: false,
            error: err instanceof Error ? err.message : "erro na distribuicao",
          };
        }

        // 2) Conta Azul — baixa de parcelas pagas.
        try {
          result.contaazul = await syncContaAzulPagamentos();
        } catch (err) {
          console.error("cron/daily:contaazul:", err);
          result.contaazul = { ok: false, error: "erro no sync contaazul" };
        }

        // 3) Asaas — baixa de parcelas pagas (fallback do webhook).
        try {
          result.asaas = await syncAsaasPagamentos();
        } catch (err) {
          console.error("cron/daily:asaas:", err);
          result.asaas = { ok: false, error: "erro no sync asaas" };
        }

        // 200 sempre (o cron não deve entrar em retentativa infinita).
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
