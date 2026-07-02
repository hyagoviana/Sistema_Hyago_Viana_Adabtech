// Roda uma query de LEITURA no banco Supabase via conexão Postgres direta.
// Uso: npx tsx scripts/db-query.ts "select ..."
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const query = process.argv[2];

if (!ref || !password) {
  console.error("Faltam SUPABASE_PROJECT_REF ou SUPABASE_DB_PASSWORD no .env.local");
  process.exit(1);
}
if (!query) {
  console.error('Uso: npx tsx scripts/db-query.ts "select ..."');
  process.exit(1);
}

const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

try {
  await client.connect();
  const res = await client.query(query);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
} catch (err) {
  console.error("ERRO:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
