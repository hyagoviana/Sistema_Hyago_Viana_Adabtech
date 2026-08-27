// Limpeza dos dados de TESTE antes de a controladoria começar a usar de verdade
// (pedido do Thiago em 27/08, aprovado pelo owner).
//
// DUAS FRENTES INDEPENDENTES:
//
//   A) TEMAS DE TESTE — 5 temas e tudo que pende deles. "Transferência de
//      Residência Médica" FICA: o Thiago confirmou que é o Pablo já preparando o
//      próximo tema a importar, não é teste.
//
//   B) MOTOR — o histórico inteiro de distribuição. O Thiago: "Nunca rodamos o
//      motor de verdade aqui (…) o ideal é o caminho C. Limpamos tudo e iniciamos
//      sem ruídos (…) assim também garantimos que o histórico e indicadores
//      reflita de fato a realidade do uso do motor".
//
// CONFERÊNCIA QUE ELE PEDIU, e o resultado: das 501 distribuições, 499 (origem
// `batch`) NÃO têm vínculo com tarefa real no ProJuris — são "a distribuir" puro.
// As outras 2 (origem `staging`) criaram tarefa lá: TAR.0042264 e TAR.0042165.
// Apagar aqui NÃO apaga lá; as duas já estão fechadas (Cancelado e Concluída com
// sucesso), então não entram na fila de ninguém.
//
// ORDEM IMPORTA. Sete tabelas apontam para `system_cases` com RESTRICT — o banco
// recusa apagar o caso antes delas. E `system_cases.tema_id` é NO ACTION, então os
// casos saem antes do tema.
//
// DRIVE: `deleteFile` do projeto move para a LIXEIRA (trashed), não apaga em
// definitivo. Reversível por 30 dias no Drive.
//
// DRY-RUN por padrão. Use --commit para executar.
// Uso: npx tsx scripts/limpeza-testes-2026-08-27.ts [--commit] [--so-temas|--so-motor]
import { config } from "dotenv";

config({ path: ".env.local" });

import pg from "pg";

const COMMIT = process.argv.includes("--commit");
const SO_TEMAS = process.argv.includes("--so-temas");
const SO_MOTOR = process.argv.includes("--so-motor");

const TEMAS_ALVO = ["frente 3", "Tema 10", "tema teste", "TESTE6", "teste7"];

/** Tabelas que apontam para o CASO com RESTRICT: têm de sair antes dele. */
const RESTRICT_DO_CASO = [
  "system_case_communications",
  "system_case_deadlines",
  "system_case_documents",
  "system_case_fin_entries",
  "system_case_tasks",
  "system_parcelas",
  "system_termo_snapshots",
];

/** Tabelas do motor, na ordem em que podem ser esvaziadas. */
const TABELAS_MOTOR = [
  "system_distribution_approvals", // cascata do results, mas explícito é melhor
  "system_distribution_writeback_log",
  "system_distribution_exceptions",
  "system_distribution_results",
  "system_distribution_staging",
  "system_distribution_kanban_tasks",
  "system_distribution_movements",
  "system_distribution_batch_logs",
  "system_distribution_simulations",
  "system_distribution_manual_assignments",
  "system_distribution_queue_state",
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
  console.log(COMMIT ? "=== MODO COMMIT ===\n" : "=== DRY-RUN (use --commit) ===\n");

  const pastasParaLixeira: Array<{ tema: string; id: string }> = [];

  // ═══ A) TEMAS DE TESTE ═════════════════════════════════════════════════════
  if (!SO_MOTOR) {
    console.log("A) TEMAS DE TESTE");
    const { rows: temas } = await db.query(
      `select id, name, drive_folder_id, drive_casos_folder_id, drive_contratacao_folder_id
         from system_temas where name = any($1) and deleted_at is null`,
      [TEMAS_ALVO],
    );
    const faltando = TEMAS_ALVO.filter((n) => !temas.some((t) => t.name === n));
    if (faltando.length) console.log(`   (já não existem: ${faltando.join(", ")})`);

    for (const tema of temas) {
      const { rows: casos } = await db.query(
        `select id, case_code from system_cases where tema_id = $1`,
        [tema.id],
      );
      const { rows: cont } = await db.query(
        `select (select count(*) from system_workflow_rules where tema_id = $1) wf,
                (select count(*) from system_tema_field_defs where tema_id = $1) campos,
                (select count(*) from system_service_types where tema_id = $1) tipos`,
        [tema.id],
      );
      console.log(
        `\n   ▸ "${tema.name}": ${casos.length} caso(s), ${cont[0].wf} workflow(s), ${cont[0].campos} campo(s), ${cont[0].tipos} tipo(s) de serviço`,
      );
      for (const c of casos) console.log(`       caso ${c.case_code}`);

      for (const col of ["drive_folder_id", "drive_casos_folder_id", "drive_contratacao_folder_id"]) {
        const id = tema[col] as string | null;
        if (id) pastasParaLixeira.push({ tema: tema.name, id });
      }

      if (COMMIT) {
        await db.query("begin");
        try {
          for (const c of casos) {
            for (const tabela of RESTRICT_DO_CASO) {
              await db.query(`delete from ${tabela} where case_id = $1`, [c.id]);
            }
            await db.query(`delete from system_cases where id = $1`, [c.id]);
          }
          // service_types é NO ACTION: sai antes do tema.
          await db.query(`delete from system_service_types where tema_id = $1`, [tema.id]);
          await db.query(`delete from system_temas where id = $1`, [tema.id]);
          await db.query("commit");
          console.log("       ✔ removido");
        } catch (err) {
          await db.query("rollback");
          console.log(`       ✘ FALHOU: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
    console.log(`\n   Pastas do Drive para a lixeira: ${pastasParaLixeira.length}`);
  }

  // ═══ B) MOTOR ══════════════════════════════════════════════════════════════
  if (!SO_TEMAS) {
    console.log("\nB) MOTOR — histórico de distribuição");
    for (const tabela of TABELAS_MOTOR) {
      const { rows } = await db
        .query(`select count(*) n from ${tabela}`)
        .catch(() => ({ rows: [{ n: "?" }] }));
      const n = rows[0].n;
      if (n === "0" || n === "?") {
        console.log(`   ${String(n).padStart(5)}  ${tabela}${n === "?" ? " (tabela não existe)" : ""}`);
        continue;
      }
      console.log(`   ${String(n).padStart(5)}  ${tabela}`);
      if (COMMIT) {
        try {
          await db.query(`delete from ${tabela}`);
          console.log("          ✔ esvaziada");
        } catch (err) {
          console.log(`          ✘ ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  // ═══ Relatório final ═══════════════════════════════════════════════════════
  console.log("\n─── depois ───");
  const { rows: fim } = await db.query(
    `select (select count(*) from system_temas where deleted_at is null) temas,
            (select count(*) from system_distribution_results) results,
            (select count(*) from system_distribution_movements) movements,
            (select count(*) from system_distribution_kanban_tasks) kanban`,
  );
  console.log(JSON.stringify(fim[0]));
  await db.end();

  if (pastasParaLixeira.length && !SO_MOTOR) {
    console.log("\n─── Drive (rodar separado, ver abaixo) ───");
    for (const p of pastasParaLixeira) console.log(`   ${p.tema}: ${p.id}`);
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
