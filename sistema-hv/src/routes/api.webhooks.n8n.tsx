import { createFileRoute } from "@tanstack/react-router";

import {
  N8nWebhookError,
  processN8nWebhook,
  type N8nIncomingPayload,
} from "@/lib/n8n-webhook-service";

export const Route = createFileRoute("/api/webhooks/n8n")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Validar secret — obrigatório para proteger contra payloads não autorizados
        const secret = process.env.N8N_WEBHOOK_SECRET;
        if (!secret) {
          console.error("api/webhooks/n8n: N8N_WEBHOOK_SECRET não configurado no .env");
          return Response.json(
            { error: "Webhook não configurado" },
            { status: 503 },
          );
        }
        const authHeader = request.headers.get("x-webhook-secret") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        if (authHeader !== secret) {
          return Response.json(
            { error: "Não autorizado" },
            { status: 401 },
          );
        }

        // Parse body. O payload é validado dentro de processN8nWebhook (campos
        // obrigatórios) e aceita os campos opcionais de documento assinado
        // (`assinado`, `documento_assinado`) — ver N8nIncomingPayload.
        let payload: N8nIncomingPayload;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Body inválido: esperava JSON" },
            { status: 400 },
          );
        }

        // Processar
        try {
          const result = await processN8nWebhook(payload);
          return Response.json(result, { status: 200 });
        } catch (err) {
          if (err instanceof N8nWebhookError) {
            return Response.json(
              { error: err.message },
              { status: err.status },
            );
          }
          console.error("api/webhooks/n8n: erro inesperado:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Erro interno" },
            { status: 500 },
          );
        }
      },
    },
  },
});
