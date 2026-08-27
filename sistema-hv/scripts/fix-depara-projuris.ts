// Corrige o de-para SHV <-> ProJuris (decisoes do owner em 2026-08-27).
//
// Tres correcoes, todas de DADO (nenhuma mudanca de schema):
//
//  1. HYAGO duplicado. Existem dois cadastros ativos para a mesma pessoa:
//     - "Hyago Viana <hyagoviana.adv@gmail.com>" — admin, 44 casos criados. REAL.
//     - "HYAGO ALVES VIANA <projuris-130405@projuris.local>" — placeholder que
//       sobrou da importacao, zero uso, so carrega o de-para 130405.
//     Move o de-para para a conta real e arquiva a fantasma. Como a fantasma nao
//     tem NADA apontando para ela (0 tarefas, 0 casos, 0 responsabilidades), a
//     fusao e' so isso — nao ha o que reatribuir.
//
//  2. De-para em formato ANTIGO. Matheus Rocha da Silva e Nicole Rocha Lopes
//     Ribas guardam "PES.0000040" / "PES.0000001" no lugar do codigo numerico.
//     `criar-tarefa.ts` faz Number(...) nesse campo -> NaN -> a tarefa nunca e'
//     espelhada, e falha em SILENCIO. Corrige para 131019 e 128860.
//     ATENCAO: os dois estao DESABILITADOS no ProJuris (habilitado=false). O
//     dado fica correto, mas o espelhamento so funciona se forem reabilitados la.
//
// DRY-RUN por padrao. Use --commit para gravar.
// Uso: npx tsx scripts/fix-depara-projuris.ts [--commit]
import { config } from "dotenv";

config({ path: ".env.local" });

import pg from "pg";

const COMMIT = process.argv.includes("--commit");

const HYAGO_REAL_EMAIL = "hyagoviana.adv@gmail.com";
const HYAGO_FANTASMA_EMAIL = "projuris-130405@projuris.local";

/** nome no SHV -> codigo numerico correto no ProJuris */
const CODIGOS_CORRETOS: Array<{ nome: string; de: string; para: string }> = [
  { nome: "Matheus Rocha da Silva", de: "PES.0000040", para: "131019" },
  { nome: "Nicole Rocha Lopes Ribas", de: "PES.0000001", para: "128860" },
];

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

  // ── 1. Hyago ──────────────────────────────────────────────────────────────
  const { rows: hyagos } = await db.query(
    `select id, full_name, email, status from system_users where email = any($1)`,
    [[HYAGO_REAL_EMAIL, HYAGO_FANTASMA_EMAIL]],
  );
  const real = hyagos.find((h) => h.email === HYAGO_REAL_EMAIL);
  const fantasma = hyagos.find((h) => h.email === HYAGO_FANTASMA_EMAIL);

  if (!real || !fantasma) {
    console.log("1. Hyago: nada a fazer (um dos dois cadastros nao existe mais).");
  } else {
    // Guarda-corpo: so arquiva se a fantasma continuar sem uso nenhum.
    const { rows: uso } = await db.query(
      `select (select count(*) from system_case_tasks where assignee_id = $1 and deleted_at is null) tarefas,
              (select count(*) from system_cases where created_by = $1) casos,
              (select count(*) from system_case_responsaveis where user_id = $1) resp`,
      [fantasma.id],
    );
    const total = Number(uso[0].tarefas) + Number(uso[0].casos) + Number(uso[0].resp);
    if (total > 0) {
      console.log(
        `1. Hyago: ABORTADO — a conta placeholder passou a ter uso (${JSON.stringify(uso[0])}). Reveja a mao.`,
      );
    } else {
      console.log(`1. Hyago: move de-para ${fantasma.id} -> ${real.id} e arquiva a placeholder.`);
      if (COMMIT) {
        await db.query("begin");
        // A conta real nao tem de-para (conferido); mover e' seguro.
        await db.query(
          `update system_projuris_executor_mapping set executor_id = $1 where executor_id = $2`,
          [real.id, fantasma.id],
        );
        await db.query(
          `update system_users set status = 'ARCHIVED', updated_at = now() where id = $1`,
          [fantasma.id],
        );
        await db.query("commit");
        console.log("   OK");
      }
    }
  }

  // ── 2. Codigos em formato antigo ──────────────────────────────────────────
  console.log("");
  for (const c of CODIGOS_CORRETOS) {
    const { rows } = await db.query(
      `select m.id, u.full_name, m.projuris_responsavel_id
         from system_projuris_executor_mapping m
         join system_users u on u.id = m.executor_id
        where m.projuris_responsavel_id = $1`,
      [c.de],
    );
    if (!rows.length) {
      console.log(`2. ${c.nome}: nada a fazer (nao encontrei ${c.de}).`);
      continue;
    }
    console.log(`2. ${rows[0].full_name}: ${c.de} -> ${c.para}`);
    if (COMMIT) {
      await db.query(
        `update system_projuris_executor_mapping set projuris_responsavel_id = $1 where id = $2`,
        [c.para, rows[0].id],
      );
      console.log("   OK");
    }
  }

  // ── Relatorio final ───────────────────────────────────────────────────────
  const { rows: resumo } = await db.query(
    `select count(*) filter (where m.projuris_responsavel_id ~ '^[0-9]+$') numericos,
            count(*) filter (where m.projuris_responsavel_id !~ '^[0-9]+$') invalidos,
            count(*) filter (where m.projuris_responsavel_id is null) sem
       from system_users u
       left join system_projuris_executor_mapping m on m.executor_id = u.id
      where u.status = 'ACTIVE'`,
  );
  console.log(`\nAtivos: ${JSON.stringify(resumo[0])}`);
  await db.end();
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
