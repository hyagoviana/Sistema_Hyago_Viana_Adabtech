import { createFileRoute } from "@tanstack/react-router";

import { processAsaasWebhook } from "@/lib/asaas/webhook";

// Webhook do Asaas — cadastre esta URL no painel do Asaas
// (Configurações → Integrações → Webhooks).
// Se ASAAS_WEBHOOK_TOKEN estiver setado, valida o header asaas-access-token.
export const Route = createFileRoute("/api/webhooks/asaas")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "Asaas webhook ativo. Use POST." }), {
          headers: { "Content-Type": "application/json" },
        }),

      POST: async ({ request }: { request: Request }) => {
        // 1) Validação de origem pelo access token do webhook
        const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
        if (webhookToken) {
          const headerToken = request.headers.get("asaas-access-token");
          if (headerToken !== webhookToken) {
            return new Response("Forbidden", { status: 403 });
          }
        }

        // 2) Lê o payload
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response("Body inválido", { status: 400 });
        }

        // 3) Processa — responde 200 rápido pro Asaas não retentar
        try {
          const result = await processAsaasWebhook(
            payload as Parameters<typeof processAsaasWebhook>[0],
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("webhook/asaas:", err);
          return new Response(JSON.stringify({ ok: false, error: "erro interno" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
