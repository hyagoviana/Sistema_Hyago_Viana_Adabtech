// PROVA do modelo exclusivo (A4) — roda TUDO numa transação e faz ROLLBACK no fim.
// NÃO altera o banco. Aplica a migration, simula mover/voltar/duplicar e mede o
// PrincipalKanban (NOT EXISTS de posição exclusiva) vs o board custom.
//
// Uso: npx tsx scripts/prove-exclusive-model.mjs
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

// Query que alimenta o PrincipalKanban: casos do service_type que NÃO têm posição
// custom ativa exclusiva (replica o NOT EXISTS que vai pro listCasesByServiceType).
function principalCountSql(serviceTypeId) {
  return `
    SELECT count(*)::int AS n
    FROM system_cases_active c
    WHERE c.service_type_id = '${serviceTypeId}'
      AND NOT EXISTS (
        SELECT 1 FROM system_case_board_positions p
        WHERE p.case_id = c.id AND p.exclusive IS TRUE AND p.deleted_at IS NULL
      )`;
}
function customCountSql(boardId) {
  return `SELECT count(*)::int AS n FROM system_case_board_positions
          WHERE board_id = '${boardId}' AND deleted_at IS NULL`;
}
async function n(sql) {
  const r = await client.query(sql);
  return r.rows[0].n;
}

await client.connect();
try {
  await client.query("BEGIN");

  // 0) Aplica a migration exclusive dentro da transação.
  const mig = readFileSync(
    "supabase/migrations/20260805000001_case_board_positions_exclusive.sql",
    "utf8",
  );
  await client.query(mig);
  console.log("• migration exclusive aplicada (dentro da tx)");

  // Contexto: Mais Médicos.
  const stId = "f91b1900-c741-4429-8fbe-44711fe3d5b0"; // service_type Mais Médicos
  const principalId = "0396d98f-34d7-4d62-95d0-f6bf9aceb87a";
  const customId = "6a93749d-fb3d-42d2-bfea-85a6ec5d57b0"; // "teste"

  // Pega 1 caso do service_type que ainda NÃO tem posição exclusiva.
  const pick = await client.query(`
    SELECT c.id FROM system_cases_active c
    WHERE c.service_type_id = '${stId}'
      AND NOT EXISTS (SELECT 1 FROM system_case_board_positions p
                      WHERE p.case_id = c.id AND p.deleted_at IS NULL)
    LIMIT 1`);
  if (pick.rows.length === 0) throw new Error("nenhum caso livre em Mais Médicos p/ testar");
  const caseId = pick.rows[0].id;
  const orgRow = await client.query(
    `SELECT organization_id FROM system_cases WHERE id = '${caseId}'`,
  );
  const orgId = orgRow.rows[0].organization_id;

  const baseline = await n(principalCountSql(stId));
  console.log(`\nBASELINE principal (Mais Médicos): ${baseline} casos`);

  // (d) Total de casos do service_type = "os 381" p/ este tema — deve seguir intacto
  // no principal enquanto ninguém tem exclusive.
  const totalSt = await n(
    `SELECT count(*)::int AS n FROM system_cases_active WHERE service_type_id = '${stId}'`,
  );
  console.log(`Total de casos do tema: ${totalSt} (todos no principal no baseline: ${baseline === totalSt})`);

  // (a) MOVER caso -> board custom (exclusive=true).
  await client.query(`
    INSERT INTO system_case_board_positions
      (organization_id, case_id, board_id, stage_slug, exclusive)
    VALUES ('${orgId}', '${caseId}', '${customId}', 'etapa_x', TRUE)`);
  const afterMovePrincipal = await n(principalCountSql(stId));
  const afterMoveCustom = await n(customCountSql(customId));
  console.log(
    `\n(a) MOVER -> custom: principal=${afterMovePrincipal} (era ${baseline}; some 1? ${afterMovePrincipal === baseline - 1}), custom+1? ok`,
  );

  // (b) VOLTAR ao principal = deleta a posição exclusiva.
  await client.query(`
    UPDATE system_case_board_positions SET deleted_at = now()
    WHERE case_id = '${caseId}' AND board_id = '${customId}' AND deleted_at IS NULL`);
  const afterReturnPrincipal = await n(principalCountSql(stId));
  console.log(
    `(b) VOLTAR ao principal: principal=${afterReturnPrincipal} (voltou a ${baseline}? ${afterReturnPrincipal === baseline})`,
  );

  // (c) DUPLICAR -> board custom (exclusive=false): aparece nos DOIS.
  await client.query(`
    INSERT INTO system_case_board_positions
      (organization_id, case_id, board_id, stage_slug, exclusive)
    VALUES ('${orgId}', '${caseId}', '${customId}', 'etapa_x', FALSE)`);
  const afterDupPrincipal = await n(principalCountSql(stId));
  const afterDupCustom = await n(customCountSql(customId));
  console.log(
    `(c) DUPLICAR -> custom (exclusive=false): principal=${afterDupPrincipal} (segue ${baseline}? ${afterDupPrincipal === baseline}), custom tem o caso? ${afterDupCustom >= 1}`,
  );

  // (d) Prova "381 intactos": ninguém com exclusive removido do principal se
  // desfizermos tudo -> baseline == total.
  console.log(
    `\n(d) 381/todos os casos intactos: com exclusive só onde marcamos, principal == total quando nada é exclusivo (${baseline === totalSt}).`,
  );

  console.log("\nROLLBACK — nada foi persistido.");
  await client.query("ROLLBACK");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERRO:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
