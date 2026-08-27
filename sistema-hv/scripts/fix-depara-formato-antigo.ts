// Converte os de-paras que ainda guardam o formato ANTIGO (`PES.0001926`) para o
// codigoUsuario numérico que a API do ProJuris realmente usa.
//
// POR QUE IMPORTA. `criar-tarefa.ts` faz `Number(projuris_responsavel_id)` — com
// "PES.0001926" isso vira NaN e a tarefa nunca é espelhada, SEM erro visível. Foi
// exatamente o defeito que travava Matheus Rocha e Nicole hoje (27/08). Os 12
// restantes estão todos em cadastros SUSPENSOS, então não incomodam ninguém agora
// — mas no dia em que alguém for reativado, o vínculo já nasce quebrado e ninguém
// percebe. Corrigir agora é mais barato que descobrir depois.
//
// Como casa: pelo E-MAIL (login no ProJuris), que é chave única dos dois lados.
// Quem não casar fica como está e é reportado — não chuto por nome.
//
// DRY-RUN por padrão. Use --commit para gravar.
import { config } from "dotenv";

config({ path: ".env.local" });

import pg from "pg";
import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

const COMMIT = process.argv.includes("--commit");
const norm = (s: string) => (s ?? "").toLowerCase().trim();

async function main() {
  const c = createProjurisClientFromEnv();
  await c.authenticateTryingVariants();
  const r = (await c.projurisPostConsulta("usuario/consulta", {
    quantidadeRegistros: 500,
    registroInicial: 0,
  })) as { usuarioConsultaResultadoWs?: Array<Record<string, unknown>> };
  const porLogin = new Map<string, { cod: string; hab: boolean; nome: string }>();
  for (const u of r.usuarioConsultaResultadoWs ?? []) {
    porLogin.set(norm(String(u.login ?? "")), {
      cod: String(u.codigoUsuario),
      hab: Boolean(u.habilitado),
      nome: String(u.nomeUsuario ?? ""),
    });
  }
  console.log(`ProJuris: ${porLogin.size} usuários\n`);

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

  const { rows } = await db.query(
    `select m.id, u.full_name, u.email, u.status, m.projuris_responsavel_id cod
       from system_projuris_executor_mapping m
       join system_users u on u.id = m.executor_id
      where m.projuris_responsavel_id !~ '^[0-9]+$'
      order by u.full_name`,
  );

  let ok = 0;
  let semPar = 0;
  for (const row of rows as Array<Record<string, string>>) {
    const alvo = porLogin.get(norm(row.email));
    if (!alvo) {
      console.log(`  SEM PAR    ${row.full_name} <${row.email}> (${row.cod}) — deixo como está`);
      semPar++;
      continue;
    }
    // O código já é de outro cadastro? O índice único recusaria.
    const { rows: dono } = await db.query(
      `select u.full_name from system_projuris_executor_mapping m
         join system_users u on u.id = m.executor_id
        where m.projuris_responsavel_id = $1 and m.id <> $2`,
      [alvo.cod, row.id],
    );
    if (dono.length) {
      console.log(`  CONFLITO   ${row.full_name}: ${alvo.cod} já é de ${dono[0].full_name}`);
      semPar++;
      continue;
    }
    console.log(
      `  ${row.cod.padEnd(12)} -> ${alvo.cod.padEnd(8)} ${row.full_name} (${alvo.hab ? "ativo lá" : "inativo lá"})`,
    );
    ok++;
    if (COMMIT) {
      await db.query(
        `update system_projuris_executor_mapping
            set projuris_responsavel_id = $1, updated_at = now() where id = $2`,
        [alvo.cod, row.id],
      );
    }
  }

  const { rows: fim } = await db.query(
    `select count(*) filter (where projuris_responsavel_id ~ '^[0-9]+$') numericos,
            count(*) filter (where projuris_responsavel_id !~ '^[0-9]+$') antigos
       from system_projuris_executor_mapping`,
  );
  console.log(`\n${ok} convertido(s), ${semPar} sem par.`);
  console.log(`Total de-paras: ${JSON.stringify(fim[0])}`);
  await db.end();
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
