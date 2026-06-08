// Gera o GOOGLE_OAUTH_REFRESH_TOKEN da conta-sistema (Docs + Drive) via
// consentimento único, e grava direto no .env.local.
//
// Uso (2 passos):
//   1) node scripts/google-oauth-setup.mjs url     -> imprime o link de consentimento
//   2) node scripts/google-oauth-setup.mjs serve   -> sobe o servidor que captura o retorno
//
// Pré: GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no .env.local.
// O OAuth Client precisa permitir o redirect http://localhost:53682/oauth2callback
// (tipo "Desktop" já permite loopback; "Web" exige adicionar essa URI).
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { OAuth2Client } from "google-auth-library";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env.local");
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
];

function parseEnv() {
  const out = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function writeRefreshToken(token) {
  let content = readFileSync(ENV_PATH, "utf8");
  if (/^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m.test(content)) {
    content = content.replace(/^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m, `GOOGLE_OAUTH_REFRESH_TOKEN=${token}`);
  } else {
    content += `\nGOOGLE_OAUTH_REFRESH_TOKEN=${token}\n`;
  }
  writeFileSync(ENV_PATH, content, "utf8");
}

const env = parseEnv();
const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("❌ Falta GOOGLE_OAUTH_CLIENT_ID e/ou GOOGLE_OAUTH_CLIENT_SECRET no .env.local");
  process.exit(1);
}

const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
const mode = process.argv[2] ?? "serve";

if (mode === "url") {
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  console.log("\n🔗 Abra este link, escolha a CONTA-SISTEMA e clique em Permitir:\n");
  console.log("   " + url + "\n");
  console.log("   (Se aparecer 'app não verificado': Avançado → Continuar.)\n");
} else {
  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith("/oauth2callback")) {
      res.writeHead(404).end("not found");
      return;
    }
    const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");
    if (!code) {
      res.writeHead(400).end("sem code");
      return;
    }
    try {
      const { tokens } = await oauth2.getToken(code);
      if (!tokens.refresh_token) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
          .end("<h2>⚠️ Sem refresh_token.</h2><p>Revogue o acesso em myaccount.google.com/permissions e tente de novo (precisa de prompt=consent).</p>");
        console.error("\n⚠️  Google não devolveu refresh_token. Revogue o acesso antigo e rode de novo.\n");
        server.close();
        process.exitCode = 1;
        return;
      }
      writeRefreshToken(tokens.refresh_token);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end("<h2>✅ Pronto!</h2><p>Refresh token salvo no .env.local. Pode fechar esta aba.</p>");
      console.log(`\n✅ Refresh token salvo no .env.local (****${tokens.refresh_token.slice(-6)})\n`);
      server.close();
    } catch (err) {
      res.writeHead(500).end("erro: " + String(err).slice(0, 200));
      console.error("\n❌ Falha ao trocar code por token:", String(err).slice(0, 300));
      server.close();
      process.exitCode = 1;
    }
  });
  server.listen(PORT, () => {
    console.log(`\n👂 Servidor de callback ouvindo em ${REDIRECT_URI}`);
    console.log("   Agora abra o link do passo 'url' e conclua o consentimento...\n");
  });
}
