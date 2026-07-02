// Aplica um arquivo .sql no banco Supabase via conexão Postgres DIRETA (pacote pg).
// Alternativa ao db-exec.ts quando o SUPABASE_ACCESS_TOKEN (Management API) expira.
// Usa SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD do .env.local.
// Tenta a conexão direta e varre as regiões do pooler até conectar.
// Roda o SQL dentro de uma transação (BEGIN/COMMIT) — rollback automático em erro.
//
// Uso:
//   npx tsx scripts/db-apply-pg.ts supabase/migrations/<arquivo>.sql
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const file = process.argv[2];

if (!ref || !password) {
  console.error("Faltam SUPABASE_PROJECT_REF ou SUPABASE_DB_PASSWORD no .env.local");
  process.exit(1);
}
if (!file) {
  console.error("Uso: npx tsx scripts/db-apply-pg.ts <arquivo.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

const REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "sa-east-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-south-1",
  "ap-northeast-1",
  "ap-northeast-2",
  "ca-central-1",
];

type Candidate = { label: string; config: pg.ClientConfig };

const candidates: Candidate[] = [
  {
    label: `direct db.${ref}.supabase.co`,
    config: {
      host: `db.${ref}.supabase.co`,
      port: 5432,
      user: "postgres",
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    },
  },
  ...REGIONS.map((r) => ({
    label: `pooler ${r}`,
    config: {
      host: `aws-0-${r}.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${ref}`,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  falhou ${cand.label}: ${msg}`);
      await client.end().catch(() => {});
    }
  }
  return null;
}

const client = await tryConnect();
if (!client) {
  console.error("Não consegui conectar em nenhum host/região.");
  process.exit(2);
}

try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`OK: aplicado ${file}`);
  process.exit(0);
} catch (err) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* noop */
  }
  console.error("ERRO ao aplicar:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
