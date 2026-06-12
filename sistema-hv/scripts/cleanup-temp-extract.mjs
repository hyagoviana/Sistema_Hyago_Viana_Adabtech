// Limpa todos os arquivos "_temp_extract" criados pela Service Account e pela
// conta OAuth no Google Drive. Esses arquivos são restos de extrações de
// placeholders de .docx que falharam na limpeza.
//
// Uso: node scripts/cleanup-temp-extract.mjs

import { config } from "dotenv";
config({ path: ".env" });

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { OAuth2Client } from "google-auth-library";

// --- Service Account ---
async function cleanupSA() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    console.log("[SA] Credenciais não configuradas, pulando...");
    return 0;
  }
  const auth = new JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });

  console.log("[SA] Buscando _temp_extract no My Drive da Service Account...");
  let deleted = 0;
  let pageToken;

  do {
    const res = await drive.files.list({
      q: "name = '_temp_extract' and trashed = false",
      fields: "nextPageToken, files(id, name, createdTime)",
      pageSize: 100,
      pageToken,
    });
    const files = res.data.files ?? [];
    console.log(`[SA] Encontrados: ${files.length} arquivos`);

    for (const f of files) {
      try {
        await drive.files.delete({ fileId: f.id });
        deleted++;
        console.log(`  ✓ Deletado ${f.id} (criado em ${f.createdTime})`);
      } catch (err) {
        // Se não pode deletar, tenta mover pra lixeira
        try {
          await drive.files.update({ fileId: f.id, requestBody: { trashed: true } });
          deleted++;
          console.log(`  ✓ Movido pra lixeira ${f.id}`);
        } catch {
          console.log(`  ✗ Falhou ${f.id}: ${err.message}`);
        }
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  // Também esvazia a lixeira da SA
  console.log("[SA] Esvaziando lixeira...");
  try {
    const trashed = await drive.files.list({
      q: "trashed = true",
      fields: "files(id, name)",
      pageSize: 200,
    });
    for (const f of (trashed.data.files ?? [])) {
      try {
        await drive.files.delete({ fileId: f.id });
        console.log(`  ✓ Removido da lixeira: ${f.name}`);
      } catch { /* ignora */ }
    }
  } catch (err) {
    console.log(`[SA] Lixeira: ${err.message}`);
  }

  return deleted;
}

// --- OAuth (conta-sistema) ---
async function cleanupOAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    console.log("[OAuth] Credenciais não configuradas, pulando...");
    return 0;
  }
  const oauth = new OAuth2Client(clientId, clientSecret);
  oauth.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth });

  console.log("[OAuth] Buscando _temp_extract na conta OAuth...");
  let deleted = 0;
  let pageToken;

  do {
    const res = await drive.files.list({
      q: "name = '_temp_extract' and trashed = false",
      fields: "nextPageToken, files(id, name, createdTime)",
      pageSize: 100,
      pageToken,
    });
    const files = res.data.files ?? [];
    console.log(`[OAuth] Encontrados: ${files.length} arquivos`);

    for (const f of files) {
      try {
        await drive.files.delete({ fileId: f.id });
        deleted++;
        console.log(`  ✓ Deletado ${f.id} (criado em ${f.createdTime})`);
      } catch (err) {
        console.log(`  ✗ Falhou ${f.id}: ${err.message}`);
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return deleted;
}

// --- Shared Drive (pasta de modelos) ---
async function cleanupSharedDrive() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;
  if (!email || !rawKey || !sharedDriveId) {
    console.log("[Shared] Sem Shared Drive configurado, pulando...");
    return 0;
  }
  const auth = new JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });

  console.log(`[Shared] Buscando _temp_extract no Shared Drive ${sharedDriveId}...`);
  let deleted = 0;
  let pageToken;

  do {
    const res = await drive.files.list({
      q: "name = '_temp_extract' and trashed = false",
      fields: "nextPageToken, files(id, name, createdTime, parents)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      driveId: sharedDriveId,
      includeItemsFromAllDrives: true,
      corpora: "drive",
    });
    const files = res.data.files ?? [];
    console.log(`[Shared] Encontrados: ${files.length} arquivos`);

    for (const f of files) {
      try {
        await drive.files.update({
          fileId: f.id,
          requestBody: { trashed: true },
          supportsAllDrives: true,
        });
        deleted++;
        console.log(`  ✓ Movido pra lixeira ${f.id} (pasta: ${f.parents?.[0]})`);
      } catch (err) {
        console.log(`  ✗ Falhou ${f.id}: ${err.message}`);
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return deleted;
}

// --- Main ---
console.log("=== Limpeza de _temp_extract do Google Drive ===\n");
const [sa, oauth, shared] = await Promise.all([
  cleanupSA().catch((e) => { console.error("[SA] Erro:", e.message); return 0; }),
  cleanupOAuth().catch((e) => { console.error("[OAuth] Erro:", e.message); return 0; }),
  cleanupSharedDrive().catch((e) => { console.error("[Shared] Erro:", e.message); return 0; }),
]);
console.log(`\n=== Concluído: ${sa + oauth + shared} arquivos removidos (SA: ${sa}, OAuth: ${oauth}, Shared: ${shared}) ===`);
