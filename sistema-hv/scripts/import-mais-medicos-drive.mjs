// Cria as pastas no Google Drive dos clientes importados pela story A8
// (import-mais-medicos.py). Roda como subprocesso do --execute do Python OU
// avulso. Reusa EXATAMENTE o caminho do app (googleapis + JWT + Shared Drive) e o
// mesmo formato de nome de pasta de clients-service.ts (buildFolderName).
//
// IDEMPOTENTE: só cria pasta para clientes com import_batch=MM_2026_08_03 e
// drive_folder_id IS NULL. Falha do Drive é NÃO-FATAL: marca drive_sync_failed=true
// + drive_sync_error e segue para o próximo (nunca aborta a carga).
//
// Uso: node scripts/import-mais-medicos-drive.mjs [--limit N]
//   env: .env.local (SUPABASE_*, GOOGLE_*). GOOGLE_DRIVE_CLIENTS_FOLDER_ID = pai.
//
// Saída: linha final JSON com { pending, created, failed }.

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import pg from "pg";
import slugify from "slugify";
import { JWT } from "google-auth-library";
import { google } from "googleapis";

const IMPORT_BATCH = "MM_2026_08_03";
const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const clientsParent = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID;
if (!ref || !password) {
  console.error("Faltam SUPABASE_PROJECT_REF/SUPABASE_DB_PASSWORD no .env.local");
  process.exit(1);
}
if (!clientsParent) {
  console.error("Falta GOOGLE_DRIVE_CLIENTS_FOLDER_ID no .env.local");
  process.exit(1);
}

const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : null;

// ---- Drive client (espelha src/lib/google/drive.ts) -----------------------
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null;
if (!email || !rawKey) {
  console.error("Faltam GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY no .env.local");
  process.exit(1);
}
const scopes = (process.env.GOOGLE_DRIVE_SCOPES?.trim()
  ? process.env.GOOGLE_DRIVE_SCOPES.split(",").map((s) => s.trim())
  : ["https://www.googleapis.com/auth/drive"]);
const auth = new JWT({ email, key: rawKey.replace(/\\n/g, "\n"), scopes });
const drive = google.drive({ version: "v3", auth });
const writeParams = sharedDriveId ? { supportsAllDrives: true } : {};

async function createFolder(name, parentId) {
  const res = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id, webViewLink",
    ...writeParams,
  });
  const id = res.data.id;
  if (!id) throw new Error("Drive não retornou id da pasta");
  return { id, url: res.data.webViewLink ?? null };
}

function buildFolderName(fullName, cpfCnpj) {
  const slug = slugify(fullName, { lower: true, strict: true, locale: "pt" });
  return `${slug}-${cpfCnpj}`;
}

// ---- DB --------------------------------------------------------------------
const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

let created = 0;
let failed = 0;
try {
  await client.connect();
  let q =
    `select id, full_name, cpf_cnpj from system_clients ` +
    `where organization_id=$1 and deleted_at is null ` +
    `and custom_fields->>'import_batch'=$2 and drive_folder_id is null ` +
    `order by cpf_cnpj`;
  if (limit) q += ` limit ${Number(limit)}`;
  const { rows } = await client.query(q, [DEFAULT_ORG, IMPORT_BATCH]);
  const pending = rows.length;
  console.error(`[drive] ${pending} cliente(s) sem pasta — criando...`);

  for (const r of rows) {
    const name = buildFolderName(r.full_name, r.cpf_cnpj);
    try {
      const folder = await createFolder(name, clientsParent);
      await client.query(
        `update system_clients set drive_folder_id=$1, drive_folder_url=$2, ` +
          `drive_sync_failed=false, drive_sync_error=null where id=$3`,
        [folder.id, folder.url, r.id],
      );
      created++;
      if (created % 25 === 0) console.error(`[drive]   ${created}/${pending} criadas...`);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
      await client.query(
        `update system_clients set drive_sync_failed=true, drive_sync_error=$1 where id=$2`,
        [msg, r.id],
      );
      failed++;
      console.error(`[drive]   FALHA ${r.cpf_cnpj} (${name}): ${msg}`);
    }
  }
  console.log(JSON.stringify({ pending, created, failed }));
  process.exit(0);
} catch (err) {
  console.error("[drive] ERRO fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
