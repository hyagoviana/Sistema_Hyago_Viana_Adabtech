// Sincroniza system_distribution_config.projuris_password com o PROJURIS_PASSWORD
// do .env.local (a senha do env é a que autentica — o smoke deu HTTP 200 com ela;
// a do banco estava dando HTTP 400). NÃO imprime o segredo.
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const dbPass = process.env.SUPABASE_DB_PASSWORD;
const pjPass = process.env.PROJURIS_PASSWORD;
const pjUser = process.env.PROJURIS_USERNAME;
const ORG = "00000000-0000-0000-0000-000000000001";

if (!pjPass) {
  console.error("PROJURIS_PASSWORD ausente no .env.local — nada a sincronizar.");
  process.exit(1);
}

async function main() {
  const c = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: dbPass,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await c.connect();
  const r = await c.query(
    `update system_distribution_config
        set projuris_password = $2,
            projuris_username = coalesce($3, projuris_username)
      where organization_id = $1`,
    [ORG, pjPass, pjUser ?? null],
  );
  console.log(
    `OK — config atualizada (linhas: ${r.rowCount}). Senha/usuário sincronizados do env.`,
  );
  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
