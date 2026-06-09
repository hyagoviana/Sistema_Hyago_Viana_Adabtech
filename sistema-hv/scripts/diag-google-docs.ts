// Diagnóstico do motor de geração de documentos (Google Docs/Drive via OAuth).
// Reproduz o copyTemplate que falha em produção e mostra a causa REAL.
// Rodar: npx tsx --env-file=.env.local scripts/diag-google-docs.ts [TEMPLATE_ID]

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const TEMPLATE_ID = process.argv[2] ?? "17ZAn5o4ySs7V0rhuGBxTEaM6okQTbnmFzSGhf4r_XUo";

function detail(e: unknown) {
  const x = e as {
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: { error?: { code?: number; message?: string } } };
  };
  const status = x?.response?.status ?? x?.response?.data?.error?.code ?? x?.code;
  const msg = x?.response?.data?.error?.message ?? x?.message;
  return `HTTP ${status ?? "?"} — ${msg ?? "(sem mensagem)"}`;
}

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  console.log("env presentes:", {
    clientId: !!clientId,
    clientSecret: !!clientSecret,
    refreshToken: !!refreshToken,
  });
  if (!clientId || !clientSecret || !refreshToken) {
    console.error("❌ Faltam variáveis OAuth no .env.local");
    process.exit(1);
  }

  const auth = new OAuth2Client(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  // 1) Identidade + escopos do token
  try {
    const at = await auth.getAccessToken();
    const info = await auth.getTokenInfo(at.token!);
    console.log("\n👤 Conta OAuth (email):", info.email);
    console.log("🔑 Escopos do token:", info.scopes);
    const hasDrive = (info.scopes ?? []).some(
      (s) => s.includes("/auth/drive") || s.includes("/auth/drive.file"),
    );
    console.log("   → tem escopo de Drive (copy)?", hasDrive ? "SIM" : "NÃO ❌");
  } catch (e) {
    console.log("⚠️  Falha ao ler tokeninfo:", detail(e));
  }

  const drive = google.drive({ version: "v3", auth });

  // 2) A conta enxerga o modelo?
  console.log("\n📄 GET do modelo", TEMPLATE_ID);
  try {
    const g = await drive.files.get({
      fileId: TEMPLATE_ID,
      supportsAllDrives: true,
      fields: "id,name,mimeType,trashed,owners(emailAddress)",
    });
    console.log("   ✅ ENXERGA:", g.data.name, "|", g.data.mimeType, "| trashed:", g.data.trashed);
    console.log("   donos:", g.data.owners?.map((o) => o.emailAddress).join(", "));
  } catch (e) {
    console.log("   ❌ NÃO ENXERGA:", detail(e));
    console.log("   → 404 = modelo não pertence/não foi compartilhado com esta conta OAuth.");
    console.log("   → 403 = sem permissão/escopo.");
  }

  // 3) Consegue copiar?
  console.log("\n📑 COPY do modelo");
  try {
    const c = await drive.files.copy({
      fileId: TEMPLATE_ID,
      supportsAllDrives: true,
      requestBody: { name: "DIAG — cópia de teste (apagar)" },
      fields: "id,webViewLink",
    });
    console.log("   ✅ COPY OK:", c.data.id);
    try {
      await drive.files.delete({ fileId: c.data.id!, supportsAllDrives: true });
      console.log("   🧹 cópia de teste removida");
    } catch {
      console.log("   (cópia de teste ficou no Drive — apague manualmente:", c.data.id, ")");
    }
    console.log("\n🎉 O motor está OK para este modelo. O erro de produção pode ser outro modelo.");
  } catch (e) {
    console.log("   ❌ COPY FALHOU:", detail(e));
  }
}

main().catch((e) => {
  console.error("erro fatal:", e);
  process.exit(1);
});
