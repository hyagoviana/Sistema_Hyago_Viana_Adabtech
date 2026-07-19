// Zera CLIENTES e tudo vinculado (casos + filhos dos casos) para testar do zero.
// MANTÉM: temas, tipos de serviço, pastas do Drive (system_service_type_folders),
// usuários, etapas de pipeline, definições de checklist/campos, audit_log.
// NÃO toca no Google Drive (só o banco).
//
// Uso:
//   npx tsx scripts/wipe-clients.ts        → DRY-RUN (só conta o que apagaria)
//   npx tsx scripts/wipe-clients.ts --yes  → APAGA de verdade
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const apply = process.argv.includes("--yes");

if (!ref || !password) {
  console.error("Faltam SUPABASE_PROJECT_REF ou SUPABASE_DB_PASSWORD no .env.local");
  process.exit(1);
}

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "sa-east-1", "eu-central-1", "eu-west-1",
  "eu-west-2", "eu-west-3", "ap-southeast-1", "ap-southeast-2", "ap-south-1",
  "ap-northeast-1", "ap-northeast-2", "ca-central-1",
];

const candidates: { label: string; config: pg.ClientConfig }[] = [
  {
    label: `direct db.${ref}.supabase.co`,
    config: {
      host: `db.${ref}.supabase.co`, port: 5432, user: "postgres", password,
      database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
    },
  },
  ...REGIONS.map((r) => ({
    label: `pooler ${r}`,
    config: {
      host: `aws-0-${r}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}`,
      password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
    } as pg.ClientConfig,
  })),
];

async function tryConnect(): Promise<pg.Client | null> {
  for (const cand of candidates) {
    const client = new pg.Client(cand.config);
    try {
      await client.connect();
      console.log(`Conectado via: ${cand.label}`);
      return client;
    } catch {
      await client.end().catch(() => {});
    }
  }
  return null;
}

async function tablesWithColumn(client: pg.Client, column: string): Promise<string[]> {
  // Só TABELAS BASE (exclui as views *_active, que não se apaga diretamente).
  const { rows } = await client.query(
    `SELECT c.table_name FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema='public' AND c.column_name=$1
       AND c.table_name LIKE 'system\\_%' AND t.table_type='BASE TABLE'
     ORDER BY c.table_name`,
    [column],
  );
  return rows.map((r) => r.table_name as string);
}

async function count(client: pg.Client, table: string): Promise<number> {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n as number;
}

const client = await tryConnect();
if (!client) {
  console.error("Não consegui conectar em nenhum host/região.");
  process.exit(2);
}

try {
  const caseChildren = (await tablesWithColumn(client, "case_id")).filter((t) => t !== "system_cases");
  const clientChildren = (await tablesWithColumn(client, "client_id")).filter(
    (t) => t !== "system_cases",
  );
  // "Netas": referenciam itens de checklist do caso (assignees). Apagadas ANTES.
  const grandChildren = await tablesWithColumn(client, "case_checklist_item_id");

  console.log("\n=== ALVOS ===");
  console.log(`Clientes (system_clients): ${await count(client, "system_clients")}`);
  console.log(`Casos (system_cases): ${await count(client, "system_cases")}`);
  console.log(`\nTabelas filhas por case_id (${caseChildren.length}):`);
  for (const t of caseChildren) console.log(`  · ${t}: ${await count(client, t)}`);
  console.log(`\nTabelas filhas por client_id (${clientChildren.length}):`);
  for (const t of clientChildren) console.log(`  · ${t}: ${await count(client, t)}`);

  if (!apply) {
    console.log("\n[DRY-RUN] Nada foi apagado. Rode com --yes para apagar.");
    process.exit(0);
  }

  console.log("\n=== APAGANDO ===");
  await client.query("BEGIN");
  // Desliga checagem de FK/triggers para não depender da ordem entre as filhas.
  await client.query("SET session_replication_role = replica");
  for (const t of grandChildren) {
    await client.query(`DELETE FROM ${t}`);
    console.log(`  apagado ${t}`);
  }
  for (const t of caseChildren) {
    await client.query(`DELETE FROM ${t}`);
    console.log(`  apagado ${t}`);
  }
  await client.query(`DELETE FROM system_cases`);
  console.log(`  apagado system_cases`);
  for (const t of clientChildren) {
    await client.query(`DELETE FROM ${t}`);
    console.log(`  apagado ${t}`);
  }
  await client.query(`DELETE FROM system_clients`);
  console.log(`  apagado system_clients`);
  await client.query("SET session_replication_role = DEFAULT");
  await client.query("COMMIT");
  console.log("\nOK: banco zerado (clientes + casos + filhos). Temas/tipos/pastas/usuários mantidos.");
  process.exit(0);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERRO:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
