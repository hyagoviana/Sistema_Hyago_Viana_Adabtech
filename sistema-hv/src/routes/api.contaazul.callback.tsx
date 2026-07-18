import { createFileRoute } from "@tanstack/react-router";

import { exchangeCodeForTokens } from "@/lib/contaazul/client";

// Rota de callback OAuth do Conta Azul.
// O redirect_uri na URL de autorização deve apontar para:
//   https://www.sistemahyagoviana.com.br/api/contaazul/callback
// (ou http://localhost:8080/api/contaazul/callback em dev)
//
// Fluxo: Conta Azul redireciona de volta com ?code=XXX → esta rota troca
// o code por access_token + refresh_token e salva em system_integrations.
export const Route = createFileRoute("/api/contaazul/callback")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");

        if (!code) {
          return new Response(
            html("Erro", "Parâmetro 'code' ausente na URL. Tente autorizar novamente."),
            { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }

        // O redirect_uri usado na troca DEVE ser idêntico ao registrado no portal
        // da Conta Azul. O domínio pode chegar sem www (redirect 301), mas o Cognito
        // exige match exato com o que foi cadastrado.
        const registeredUri = "https://www.sistemahyagoviana.com.br/api/contaazul/callback";
        const redirectUri = url.origin.includes("localhost")
          ? `${url.origin}/api/contaazul/callback`
          : registeredUri;

        try {
          await exchangeCodeForTokens(code, redirectUri);
          return new Response(
            html(
              "Conta Azul conectada!",
              "Token salvo com sucesso. Você já pode fechar esta aba e voltar ao sistema.",
            ),
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        } catch (err) {
          console.error("contaazul/callback:", err);
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          return new Response(
            html("Falha na autorização", `Erro ao trocar o code por token: ${msg}`),
            { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      },
    },
  },
});

function html(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f7f4}
.card{background:#fff;border-radius:12px;padding:40px;max-width:420px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)}
h1{font-size:20px;margin:0 0 12px;color:#1a2233}p{color:#666;font-size:14px;line-height:1.5}</style>
</head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body>
</html>`;
}
