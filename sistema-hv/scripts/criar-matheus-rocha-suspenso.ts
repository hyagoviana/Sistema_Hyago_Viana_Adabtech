// Item 3 do Thiago (27/08), reafirmado pelo owner: o estagiário "Matheus Rocha da
// Silva" precisa existir no SHV como cadastro SUSPENSO, com e-mail
// matheusrocha@ e vinculado ao usuário dele no ProJuris (PES.0000040 =
// codigoUsuario 131019, inativo lá).
//
// Por que ele não existia: a importação de 07/08 gravou o NOME dele no cadastro
// de <financeiro@>, que na verdade é do Matheus Moreira Rodrigues. O item 4 já
// desfez essa troca; este script cria o cadastro que faltava.
//
// Molde: os outros estagiários que saíram (Gabriel Pereira Mourão, Micael
// Medeiro) — role operacional, cargo estagiario, SUSPENDED, fora da distribuição.
// Diferença proposital: o de-para vai com o código NUMÉRICO (131019). Os 12
// suspensos legados ainda guardam o formato antigo `PES.*`, que o motor não
// consegue ler (`Number(...)` → NaN); não vou repetir o defeito num registro novo.
//
// Sem login no Auth: cadastro suspenso não acessa o sistema.
//
// DRY-RUN por padrão. Use --commit para gravar.
import { config } from "dotenv";

config({ path: ".env.local" });

import pg from "pg";
import { randomUUID } from "node:crypto";

const COMMIT = process.argv.includes("--commit");

const EMAIL = "matheusrocha@hyagovianaadvocacia.com.br";
const NOME = "Matheus Rocha da Silva";
const COD_PROJURIS = "131019"; // PES.0000040 — inativo no ProJuris

async function main() {
  const db = new pg.Client({
    host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  console.log(COMMIT ? "MODO COMMIT\n" : "DRY-RUN (use --commit para gravar)\n");

  const { rows: existe } = await db.query(`select id, status from system_users where email = $1`, [
    EMAIL,
  ]);
  if (existe.length) {
    console.log(`Cadastro já existe (${existe[0].status}) — nada a criar.`);
    await db.end();
    return;
  }

  // O código já pertence a alguém? (índice único por organização)
  const { rows: dono } = await db.query(
    `select u.full_name, u.email from system_projuris_executor_mapping m
       join system_users u on u.id = m.executor_id
      where m.projuris_responsavel_id = $1`,
    [COD_PROJURIS],
  );
  if (dono.length) {
    console.log(`ABORTADO: o código ${COD_PROJURIS} já está com ${dono[0].full_name} <${dono[0].email}>.`);
    await db.end();
    return;
  }

  const id = randomUUID();
  const org = "00000000-0000-0000-0000-000000000001";
  console.log(`Cria "${NOME}" <${EMAIL}>`);
  console.log(`  status=SUSPENDED  role=operacional  cargo=estagiario  fora da distribuição`);
  console.log(`  de-para ProJuris = ${COD_PROJURIS} (inativo lá, active=false)`);

  if (COMMIT) {
    await db.query("begin");
    await db.query(
      `insert into system_users
         (id, organization_id, email, full_name, role, status, cargo,
          peticionante, participa_distribuicao_padrao, status_projuris, created_at, updated_at)
       values ($1, $2, $3, $4, 'operacional', 'SUSPENDED', 'estagiario',
               false, false, 'desabilitado', now(), now())`,
      [id, org, EMAIL, NOME],
    );
    await db.query(
      `insert into system_projuris_executor_mapping
         (organization_id, executor_id, projuris_responsavel_id, active, weight)
       values ($1, $2, $3, false, 100.00)`,
      [org, id, COD_PROJURIS],
    );
    await db.query("commit");
    console.log("  OK");
  }
  await db.end();
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
