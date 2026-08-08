// M15 (2026-08-08) — Importador de colaboradores (pg direto, sem supabase-js).
// Consome o JSON normalizado gerado por scripts/import-colaboradores-dryrun.py.
//
// Modos:
//   (default) --dry-run      : só imprime o plano; NÃO escreve.
//   --apply-archived         : cria/atualiza os ARQUIVADOS (registro sem acesso,
//                              status=ARCHIVED, SEM Auth/e-mail) + de-para de
//                              código ProJuris no mapping (active=false).
//   --apply-active           : (NÃO IMPLEMENTADO neste passo) dados dos ativos
//                              sem convite — precisa de decisão de onboarding/Auth.
//
// Idempotente: casa por e-mail (lower/trim). Roda em transação.
//
// Uso (de dentro de sistema-hv/):
//   npx tsx scripts/import-colaboradores.ts --dry-run
//   npx tsx scripts/import-colaboradores.ts --apply-archived
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const ORG = "00000000-0000-0000-0000-000000000001";
// O dry-run (python) roda da RAIZ e grava em <raiz>/scripts/; o importador roda
// de sistema-hv/ → sobe um nível.
const JSON_PATH = "../scripts/colaboradores-normalizado.json";
const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const mode = process.argv[2] ?? "--dry-run";

if (!ref || !password) {
  console.error("Faltam SUPABASE_PROJECT_REF ou SUPABASE_DB_PASSWORD no .env.local");
  process.exit(1);
}

type Person = {
  nome: string;
  email: string | null;
  role: string;
  cargo: string | null;
  time: string | null;
  status_projuris: string | null;
  arquivado: boolean;
  projuris_id: string | null;
};

const REGIONS = [
  "us-east-1",
  "us-east-2",
  "sa-east-1",
  "us-west-1",
  "eu-central-1",
  "eu-west-1",
  "ap-southeast-1",
];

async function tryConnect(): Promise<pg.Client | null> {
  const candidates: { label: string; config: pg.ClientConfig }[] = [
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
  for (const c of candidates) {
    const client = new pg.Client(c.config);
    try {
      await client.connect();
      console.log(`Conectado via: ${c.label}`);
      return client;
    } catch (err) {
      console.log(`  falhou ${c.label}: ${err instanceof Error ? err.message : String(err)}`);
      await client.end().catch(() => {});
    }
  }
  return null;
}

async function upsertArchived(client: pg.Client, p: Person) {
  // Todos os arquivados da planilha têm e-mail — casa por e-mail (lower).
  const found = await client.query<{ id: string }>(
    "SELECT id FROM system_users WHERE organization_id=$1 AND lower(email)=lower($2) AND deleted_at IS NULL",
    [ORG, p.email],
  );
  let id: string;
  let action: string;
  if (found.rows.length) {
    id = found.rows[0].id;
    action = "atualizado";
    await client.query(
      `UPDATE system_users SET status='ARCHIVED', status_projuris='desabilitado',
         full_name=$2, cargo=$3, equipe=$4, updated_at=now() WHERE id=$1`,
      [id, p.nome, p.cargo, p.time],
    );
  } else {
    id = randomUUID();
    action = "criado";
    await client.query(
      `INSERT INTO system_users (id, organization_id, email, full_name, role, status, cargo, equipe, status_projuris)
       VALUES ($1,$2,$3,$4,$5,'ARCHIVED',$6,$7,'desabilitado')`,
      [id, ORG, p.email, p.nome, p.role, p.cargo, p.time],
    );
  }
  // De-para de código ProJuris → system_users (mapping INATIVO). Serve p/ o espelho
  // de tarefas do ProJuris resolver o autor arquivado sem quebrar (M17).
  if (p.projuris_id) {
    await client.query(
      `INSERT INTO system_projuris_executor_mapping
         (organization_id, executor_id, projuris_responsavel_id, active, weight, eligible_complex)
       VALUES ($1,$2,$3,false,100,false)
       ON CONFLICT (organization_id, projuris_responsavel_id)
       DO UPDATE SET executor_id=EXCLUDED.executor_id, active=false`,
      [ORG, id, p.projuris_id],
    );
  }
  return action;
}

async function main() {
  const data = JSON.parse(readFileSync(JSON_PATH, "utf8")) as { people: Person[] };
  const archived = data.people.filter((p) => p.arquivado);
  const active = data.people.filter((p) => !p.arquivado);

  console.log("=".repeat(72));
  console.log(`Importador de colaboradores — modo: ${mode}`);
  console.log(`  arquivados: ${archived.length} · ativos: ${active.length}`);
  console.log("=".repeat(72));

  if (mode === "--apply-active") {
    console.log(
      "NÃO IMPLEMENTADO neste passo. Os ATIVOS precisam de decisão de onboarding/Auth\n" +
        "(criar registro pré-montado sem e-mail vs convite). Rode --apply-archived agora;\n" +
        "os ativos+convites ficam para o passo seguinte (ver Story M15 T4).",
    );
    process.exit(0);
  }

  if (mode !== "--apply-archived") {
    // dry-run
    console.log("\n(DRY-RUN — nada escrito). Arquivados que seriam criados/atualizados:");
    for (const p of archived) {
      console.log(`  ${p.nome} <${p.email}> PES=${p.projuris_id ?? "-"}`);
    }
    console.log("\nUse --apply-archived para escrever (sem e-mail, sem Auth).");
    process.exit(0);
  }

  const client = await tryConnect();
  if (!client) {
    console.error("Não consegui conectar ao banco.");
    process.exit(2);
  }
  const results: string[] = [];
  try {
    await client.query("BEGIN");
    for (const p of archived) {
      const action = await upsertArchived(client, p);
      results.push(`  [${action}] ${p.nome} <${p.email}> PES=${p.projuris_id ?? "-"}`);
    }
    await client.query("COMMIT");
    console.log(`\nOK — ${archived.length} arquivado(s) processado(s) (sem e-mail, sem Auth):`);
    results.forEach((r) => console.log(r));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO — rollback:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
