// Desembaralha os cadastros duplicados de Hyago, Nicole e Matheus.
// Instruções do Thiago em 27/08 + correção de uma falha do script anterior.
//
// POR QUE EXISTEM DUPLICATAS. O ProJuris não apaga usuário: ao liberar o slot
// pago ele marca "inativo" e mantém o registro. Quem troca de e-mail/cargo ganha
// um usuário NOVO e fica com dois. A importação de 07/08 trouxe cada usuário do
// ProJuris como um cadastro placeholder `projuris-<cod>@projuris.local` no SHV,
// e casou o cadastro REAL da pessoa com o registro ANTIGO — daí o embaralhamento.
//
// O QUE O THIAGO DETERMINOU (27/08):
//   1. Nicole antiga (PES.0000001 = 128860, inativa) fica no ProJuris só como
//      histórico, SEM vínculo com o SHV.
//   2. A Nicole do SHV aponta para o usuário que ela usa hoje — "Controladoria"
//      (PES.0003061 = codigoUsuario 128861, ATIVO).
//   3. O estagiário "Matheus Rocha da Silva" <matheusrocha@> (PES.0000040 =
//      131019) saiu: cadastro suspenso, vínculo preservado.
//   4. Quem usa <financeiro@> é MATHEUS MOREIRA RODRIGUES, do administrativo —
//      não tem nem precisa de usuário no ProJuris.
//
// DISTRIBUIÇÕES NÃO SE MOVEM — e isso é de propósito. Um trigger no banco recusa
// UPDATE em `system_distribution_results`: "Registros de distribuicao sao
// imutaveis (auditoria juridica)". Faz sentido: o histórico registra para QUEM a
// tarefa foi distribuída naquele dia, e reescrever isso seria falsear auditoria.
// Portanto, os placeholders que carregam distribuições continuam carregando-as
// mesmo depois de arquivados — o relatório mostra o nome que valia à época, que é
// o comportamento correto. A fusão move só o que é cadastro vivo.
//
// DRY-RUN por padrão. Use --commit para gravar.
// Uso: npx tsx scripts/fix-usuarios-nicole-matheus.ts [--commit]
import { config } from "dotenv";

config({ path: ".env.local" });

import pg from "pg";

const COMMIT = process.argv.includes("--commit");

const HYAGO_REAL = "hyagoviana.adv@gmail.com";
const HYAGO_PLACEHOLDER = "projuris-130405@projuris.local";

const NICOLE_EMAIL = "controladoria@hyagovianaadvocacia.com.br";
const NICOLE_PLACEHOLDER = "projuris-128861@projuris.local";
const NICOLE_COD_NOVO = "128861"; // "Controladoria", ATIVO — PES.0003061
const NICOLE_COD_ANTIGO = "128860"; // inativo — PES.0000001

const FINANCEIRO_EMAIL = "financeiro@hyagovianaadvocacia.com.br";
const NOME_CORRETO_FINANCEIRO = "Matheus Moreira Rodrigues";

const ESTAGIARIO_EMAIL = "matheusrocha@hyagovianaadvocacia.com.br";
const ESTAGIARIO_COD = "131019"; // inativo — PES.0000040

type Db = pg.Client;

async function idPorEmail(db: Db, email: string): Promise<string | null> {
  const { rows } = await db.query(`select id from system_users where email = $1`, [email]);
  return rows[0]?.id ?? null;
}

/** Tudo que amarra trabalho a um cadastro — usado como guarda-corpo E como lista
 *  do que precisa ser reatribuído numa fusão. */
async function vinculos(db: Db, userId: string) {
  const { rows } = await db.query(
    `select (select count(*) from system_case_tasks where assignee_id = $1 and deleted_at is null) tarefas,
            (select count(*) from system_cases where created_by = $1) casos,
            (select count(*) from system_case_responsaveis where user_id = $1) resp,
            (select count(*) from system_distribution_results where executor_id = $1) dist,
            (select count(*) from system_case_checklist_item_assignees where user_id = $1) chk`,
    [userId],
  );
  const r = rows[0];
  return {
    ...r,
    total: Number(r.tarefas) + Number(r.casos) + Number(r.resp) + Number(r.dist) + Number(r.chk),
  };
}

/** Move todo vínculo de trabalho de `de` para `para`. Só faz sentido quando os
 *  dois cadastros são a MESMA pessoa. */
async function reatribuir(db: Db, de: string, para: string) {
  await db.query(`update system_case_tasks set assignee_id = $2 where assignee_id = $1`, [de, para]);
  await db.query(`update system_cases set created_by = $2 where created_by = $1`, [de, para]);
  // system_distribution_results NÃO entra: é imutável por trigger (ver cabeçalho).
  // Estas duas podem colidir com linha já existente do destino (chave composta).
  await db.query(
    `update system_case_responsaveis r set user_id = $2 where user_id = $1
       and not exists (select 1 from system_case_responsaveis x
                        where x.case_id = r.case_id and x.user_id = $2)`,
    [de, para],
  );
  await db.query(`delete from system_case_responsaveis where user_id = $1`, [de]);
  await db.query(
    `update system_case_checklist_item_assignees a set user_id = $2 where user_id = $1
       and not exists (select 1 from system_case_checklist_item_assignees x
                        where x.item_id = a.item_id and x.user_id = $2)`,
    [de, para],
  );
  await db.query(`delete from system_case_checklist_item_assignees where user_id = $1`, [de]);
}

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

  // ── 0. Conserta o que o script anterior deixou pendurado no Hyago ────────
  const hyagoReal = await idPorEmail(db, HYAGO_REAL);
  const hyagoPh = await idPorEmail(db, HYAGO_PLACEHOLDER);
  if (hyagoReal && hyagoPh) {
    const v = await vinculos(db, hyagoPh);
    const movivel = v.total - Number(v.dist);
    if (movivel === 0) {
      console.log(
        `0. Hyago: placeholder tem ${v.dist} distribuição(ões) — ficam lá (imutáveis) e nada mais a mover.`,
      );
    } else {
      console.log(`0. Hyago: reatribui ${JSON.stringify(v)} (menos distribuições) para a conta real.`);
      if (COMMIT) {
        await db.query("begin");
        await reatribuir(db, hyagoPh, hyagoReal);
        await db.query("commit");
        console.log("   OK");
      }
    }
  } else {
    console.log("0. Hyago: nada a fazer.");
  }

  // ── 1 e 2. Nicole: funde o placeholder e aponta para o usuário atual ─────
  console.log("");
  const nicole = await idPorEmail(db, NICOLE_EMAIL);
  const nicolePh = await idPorEmail(db, NICOLE_PLACEHOLDER);
  if (!nicole) {
    console.log("1/2. Nicole: cadastro não encontrado — nada a fazer.");
  } else {
    const v = nicolePh ? await vinculos(db, nicolePh) : null;
    console.log(`1/2. Nicole:`);
    console.log(`     · solta o de-para ${NICOLE_COD_ANTIGO} (o antigo fica só no ProJuris)`);
    if (nicolePh) {
      console.log(`     · traz o de-para ${NICOLE_COD_NOVO} do placeholder "Controladoria"`);
      console.log(
        `     · reatribui ${JSON.stringify(v)} do placeholder (as ${v?.dist} distribuições ficam lá — imutáveis)`,
      );
      console.log(`     · arquiva o placeholder`);
    }
    if (COMMIT) {
      await db.query("begin");
      // Solta o vínculo antigo dela ANTES de trazer o novo (índice único por org).
      await db.query(
        `delete from system_projuris_executor_mapping
          where executor_id = $1 and projuris_responsavel_id = $2`,
        [nicole, NICOLE_COD_ANTIGO],
      );
      if (nicolePh) {
        await reatribuir(db, nicolePh, nicole);
        await db.query(
          `update system_projuris_executor_mapping set executor_id = $1 where executor_id = $2`,
          [nicole, nicolePh],
        );
        await db.query(`update system_users set status = 'ARCHIVED', updated_at = now() where id = $1`, [
          nicolePh,
        ]);
      }
      await db.query("commit");
      console.log("     OK");
    }
  }

  // ── 4. financeiro@ é o Matheus Moreira, do administrativo ───────────────
  console.log("");
  const fin = await idPorEmail(db, FINANCEIRO_EMAIL);
  if (!fin) {
    console.log("4. financeiro@: cadastro não encontrado — nada a fazer.");
  } else {
    const v = await vinculos(db, fin);
    console.log(`4. financeiro@ -> "${NOME_CORRETO_FINANCEIRO}" e REMOVE o de-para ${ESTAGIARIO_COD}`);
    console.log(`     (vínculos do cadastro: ${JSON.stringify(v)} — ficam com ele, é a mesma conta)`);
    if (COMMIT) {
      await db.query(`update system_users set full_name = $1, updated_at = now() where id = $2`, [
        NOME_CORRETO_FINANCEIRO,
        fin,
      ]);
      await db.query(`delete from system_projuris_executor_mapping where executor_id = $1`, [fin]);
      console.log("     OK");
    }
  }

  // ── 3. Estagiário que saiu ───────────────────────────────────────────────
  console.log("");
  const est = await idPorEmail(db, ESTAGIARIO_EMAIL);
  if (est) {
    console.log("3. Estagiário: cadastro existe — garante SUSPENDED.");
    if (COMMIT) {
      await db.query(`update system_users set status = 'SUSPENDED', updated_at = now() where id = $1`, [
        est,
      ]);
      console.log("     OK");
    }
  } else {
    console.log(`3. Estagiário <${ESTAGIARIO_EMAIL}>: NÃO existe no SHV, e NÃO vou criar.`);
    console.log("     Criar cadastro de quem já saiu, só para carregar vínculo com um usuário");
    console.log("     INATIVO do ProJuris, não tem efeito operacional (não dá para distribuir");
    console.log("     tarefa a ele) e é decisão do owner. O histórico já vive no ProJuris.");
  }

  // ── Relatório ────────────────────────────────────────────────────────────
  const { rows: fim } = await db.query(
    `select count(*) filter (where m.projuris_responsavel_id ~ '^[0-9]+$') com_depara,
            count(*) filter (where m.projuris_responsavel_id is null) sem_depara
       from system_users u
       left join system_projuris_executor_mapping m on m.executor_id = u.id
      where u.status = 'ACTIVE'`,
  );
  const { rows: orfaos } = await db.query(
    `select count(*) n from system_users u
      where u.email like '%@projuris.local' and u.status <> 'ARCHIVED'`,
  );
  console.log(`\nAtivos: ${JSON.stringify(fim[0])} | placeholders não arquivados: ${orfaos[0].n}`);
  await db.end();
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
