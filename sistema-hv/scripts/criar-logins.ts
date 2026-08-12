// Cria as contas de LOGIN dos colaboradores da planilha, com senha provisória
// e a marca "trocar no 1º login". Preserva o id da ficha (system_users.id) para
// não quebrar vínculos (casos/responsáveis/distribuição), inserindo direto em
// auth.users + auth.identities (a Admin API não deixa fixar o id).
//
// SEGURANÇA: dry-run por padrão. Só grava com a flag --commit.
//   Dry-run:  npx tsx scripts/criar-logins.ts
//   Executar: npx tsx scripts/criar-logins.ts --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";
import pg from "pg";

const PROVISORIA = "123456";
const COMMIT = process.argv.includes("--commit");

const ref = process.env.SUPABASE_PROJECT_REF!;
const password = process.env.SUPABASE_DB_PASSWORD!;

const REGIONS = ["us-east-1", "us-east-2", "sa-east-1", "us-west-1"];
const candidates: pg.ClientConfig[] = [
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres", password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 },
  ...REGIONS.map((r) => ({ host: `aws-0-${r}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}`, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 } as pg.ClientConfig)),
];

async function connect(): Promise<pg.Client> {
  for (const c of candidates) {
    const client = new pg.Client(c);
    try { await client.connect(); return client; }
    catch { await client.end().catch(() => {}); }
  }
  throw new Error("sem conexão");
}

type Row = { nome: string; email: string; status_planilha: string };
const planilha: Row[] = JSON.parse(readFileSync("scripts/_colaboradores.json", "utf8"));

const client = await connect();

type Plan = { row: Row; fichaId: string | null; fichaStatus: string | null; hasAuth: boolean };
const plans: Plan[] = [];

for (const row of planilha) {
  const { rows: fichas } = await client.query(
    `SELECT id, status FROM system_users WHERE lower(email)=lower($1) AND deleted_at IS NULL LIMIT 1`,
    [row.email],
  );
  const ficha = fichas[0] ?? null;
  const { rows: auths } = await client.query(
    `SELECT id FROM auth.users WHERE lower(email)=lower($1) LIMIT 1`,
    [row.email],
  );
  plans.push({
    row,
    fichaId: ficha?.id ?? null,
    fichaStatus: ficha?.status ?? null,
    hasAuth: auths.length > 0,
  });
}

const toCreate = plans.filter((p) => p.fichaId && !p.hasAuth);
const already = plans.filter((p) => p.hasAuth);
const noFicha = plans.filter((p) => !p.fichaId);

console.log(`\n=== RECONCILIAÇÃO (planilha × banco) — ${COMMIT ? "MODO COMMIT" : "DRY-RUN"} ===\n`);
console.log(`Total na planilha:        ${planilha.length}`);
console.log(`→ CRIAR login (tem ficha, sem login): ${toCreate.length}`);
console.log(`→ Já têm login (pular):               ${already.length}`);
console.log(`→ SEM ficha no sistema (pular):       ${noFicha.length}\n`);

console.log("-- CRIAR login (senha 123456 + trocar no 1º acesso, status→ACTIVE): --");
for (const p of toCreate) console.log(`   [${p.row.status_planilha.padEnd(7)}] ${p.row.email.padEnd(44)} ficha=${p.fichaStatus}`);

if (already.length) {
  console.log("\n-- Já têm login (não mexo): --");
  for (const p of already) console.log(`   ${p.row.email}`);
}
if (noFicha.length) {
  console.log("\n-- SEM ficha em system_users (NÃO crio — precisa decisão): --");
  for (const p of noFicha) console.log(`   [${p.row.status_planilha.padEnd(7)}] ${p.row.email}`);
}

if (!COMMIT) {
  console.log("\n(DRY-RUN — nada foi gravado. Rode com --commit para criar.)");
  await client.end();
  process.exit(0);
}

// ---- COMMIT ----
console.log("\nCriando logins…");
let ok = 0;
await client.query("BEGIN");
try {
  for (const p of toCreate) {
    const id = p.fichaId!;
    const email = p.row.email;
    await client.query(
      `INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
         raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous,
         confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,
         phone_change,phone_change_token,reauthentication_token)
       VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,
         crypt($3,gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,'{"email_verified":true}'::jsonb,
         now(), now(), false, false, '','','','','','','','')`,
      [id, email, PROVISORIA],
    );
    await client.query(
      `INSERT INTO auth.identities (user_id,provider,provider_id,identity_data,last_sign_in_at,created_at,updated_at)
       VALUES ($1::uuid,'email',$1::text,
         jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',false,'phone_verified',false),
         now(),now(),now())`,
      [id, email],
    );
    await client.query(
      `UPDATE system_users SET status='ACTIVE', must_change_password=true, updated_at=now() WHERE id=$1`,
      [id],
    );
    ok++;
  }
  await client.query("COMMIT");
  console.log(`OK: ${ok} login(s) criados com senha provisória.`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERRO — rollback:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
