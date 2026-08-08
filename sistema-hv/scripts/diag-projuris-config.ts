// Diagnóstico da config do ProJuris (NÃO imprime segredos — só presença/mascara).
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const ORG = "00000000-0000-0000-0000-000000000001";

const mask = (v: unknown) => {
  if (v == null || v === "") return "(vazio)";
  const s = String(v);
  return s.length <= 4 ? "***" : s.slice(0, 2) + "…" + s.slice(-2) + ` (len ${s.length})`;
};
const has = (k: string) => (process.env[k] && process.env[k]!.trim() ? "SET" : "FALTA");

async function main() {
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();

  const { rows } = await client.query(
    `select projuris_base_url, projuris_auth_type, projuris_username,
            projuris_password, projuris_token, projuris_api_key
       from system_distribution_config where organization_id = $1`,
    [ORG],
  );
  process.stdout.write("=== system_distribution_config ===\n");
  if (!rows.length) {
    process.stdout.write("  (NENHUMA LINHA — config não existe)\n");
  } else {
    const r = rows[0];
    process.stdout.write(`  base_url:  ${r.projuris_base_url ?? "(vazio)"}\n`);
    process.stdout.write(`  auth_type: ${r.projuris_auth_type ?? "(vazio)"}\n`);
    process.stdout.write(`  username:  ${r.projuris_username ?? "(vazio)"}\n`);
    process.stdout.write(`  password:  ${mask(r.projuris_password)}\n`);
    process.stdout.write(`  token:     ${mask(r.projuris_token)}\n`);
    process.stdout.write(`  api_key:   ${mask(r.projuris_api_key)}\n`);
  }

  process.stdout.write("=== env (.env.local) — presença ===\n");
  for (const k of [
    "PROJURIS_API_CLIENTE_CODIGO",
    "PROJURIS_CLIENT_SECRET",
    "PROJURIS_DOMINIO",
    "PROJURIS_AUTH_URL",
    "PROJURIS_BASE_URL",
    "PROJURIS_USERNAME",
    "PROJURIS_PASSWORD",
  ]) {
    process.stdout.write(`  ${k}: ${has(k)}\n`);
  }

  // De-para de tipos/temas do motor (para saber se os códigos ProJuris já existem).
  const tt = await client.query(
    "select count(*) c, count(*) filter (where projuris_tipo_codigo is not null and projuris_tipo_codigo <> '') com_codigo from system_task_type_mapping where organization_id=$1",
    [ORG],
  );
  const th = await client.query(
    "select count(*) c, count(*) filter (where projuris_tema_codigo is not null and projuris_tema_codigo <> '') com_codigo from system_theme_mapping where organization_id=$1",
    [ORG],
  );
  const ex = await client.query(
    "select count(*) c, count(*) filter (where active) ativos from system_projuris_executor_mapping where organization_id=$1",
    [ORG],
  );
  process.stdout.write("=== de-para do motor ===\n");
  process.stdout.write(
    `  tipos de tarefa: ${tt.rows[0].c} (com código ProJuris: ${tt.rows[0].com_codigo})\n`,
  );
  process.stdout.write(
    `  temas: ${th.rows[0].c} (com código ProJuris: ${th.rows[0].com_codigo})\n`,
  );
  process.stdout.write(
    `  executores no mapping: ${ex.rows[0].c} (active=true: ${ex.rows[0].ativos})\n`,
  );

  await client.end();
}

main().catch((e) => {
  process.stderr.write("ERRO: " + (e instanceof Error ? e.message : String(e)) + "\n");
  process.exit(1);
});
