// Cruza os usuarios ATIVOS do SHV com os usuarios reais do ProJuris.
// Responde a duvida do Thiago (27/08): "nem todo mundo do administrativo tem
// usuario no ProJuris, isso nao vai dar problema?" — em vez de pedir a lista a
// ele, a gente descobre pela API, que o acesso ja temos.
//
// SOMENTE LEITURA.
// Uso: npx tsx scripts/diag-projuris-usuarios.ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";
import pg from "pg";

function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length) return val;
      if (val && typeof val === "object") {
        const inner = firstArrayDeep(val);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  let lista: Array<Record<string, unknown>> = [];
  for (const tentativa of [
    () => client.projurisGet("usuario"),
    () => client.projurisGet("usuario/consulta"),
    () => client.projurisPostConsulta("usuario/consulta", { quantidadeRegistros: 500, registroInicial: 0 }),
  ]) {
    const r = await tentativa().catch(() => null);
    const arr = firstArrayDeep(r) as Array<Record<string, unknown>>;
    if (arr.length) {
      lista = arr;
      break;
    }
  }
  console.log(`ProJuris: ${lista.length} usuarios\n`);
  if (lista[0]) console.log("campos:", Object.keys(lista[0]).join(", "), "\n");

  const c = new pg.Client({
    host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const { rows: users } = await c.query(
    `select u.id, u.full_name, u.email, m.projuris_responsavel_id
       from system_users u
       left join system_projuris_executor_mapping m on m.executor_id = u.id
      where u.status = 'ACTIVE'
      order by u.full_name`,
  );

  const idsProjuris = new Set(
    lista.map((u) => String(u.codigoUsuario ?? u.codigo ?? u.codigoPessoa ?? "")).filter(Boolean),
  );

  console.log("SHV ativo -> tem usuario no ProJuris?");
  let semMapa = 0;
  let mapaOrfao = 0;
  for (const u of users as Array<Record<string, string>>) {
    const cod = u.projuris_responsavel_id;
    if (!cod) {
      console.log(`  SEM DE-PARA   ${u.full_name} <${u.email}>`);
      semMapa++;
    } else if (idsProjuris.size && !idsProjuris.has(String(cod))) {
      console.log(`  ORFAO (${cod})  ${u.full_name} — de-para aponta para codigo que nao esta na lista`);
      mapaOrfao++;
    }
  }
  console.log(`\n${users?.length ?? 0} ativos | ${semMapa} sem de-para | ${mapaOrfao} com de-para orfao`);
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
