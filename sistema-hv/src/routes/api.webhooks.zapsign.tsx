import { createFileRoute } from "@tanstack/react-router";

import { processZapsignWebhook } from "@/lib/zapsign/webhook";

// Recebimento AUTOMÁTICO do ZapSign. Cadastre esta URL no painel do ZapSign
// (Configurações → Webhooks). Se ZAPSIGN_WEBHOOK_SECRET estiver setado, anexe
// ?secret=... na URL cadastrada para validar a origem.
export const Route = createFileRoute("/api/webhooks/zapsign")({
  server: {
    handlers: {
      // GET só para você conferir no navegador que a rota está no ar.
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "ZapSign webhook ativo. Use POST." }), {
          headers: { "Content-Type": "application/json" },
        }),

      POST: async ({ request }: { request: Request }) => {
        // 1) Validação opcional de origem por secret na query.
        const secret = process.env.ZAPSIGN_WEBHOOK_SECRET;
        if (secret) {
          const url = new URL(request.url);
          if (url.searchParams.get("secret") !== secret) {
            return new Response("Forbidden", { status: 403 });
          }
        }

        // 2) Lê o evento empurrado pelo ZapSign.
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response("Body inválido", { status: 400 });
        }

        // 3) Processa (baixa o assinado → pasta). Responde 200 rápido pro ZapSign.
        try {
          const result = await processZapsignWebhook(payload);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("webhook/zapsign:", err);
          // 200 mesmo em erro interno evita retentativas infinitas; logamos pra investigar.
          return new Response(JSON.stringify({ ok: false, error: "erro interno" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
