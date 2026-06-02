// E2E do módulo Casos sem browser — usa cases-service diretamente.
//
// Uso:
//   npm run test:cases

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  createCase,
  getCase,
  listCaseEvents,
  listCases,
  moveCaseStatus,
  moveCaseStatusFin,
  softDeleteCase,
  updateCase,
} from "../src/lib/cases-service";
import { createClient, softDeleteClient } from "../src/lib/clients-service";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function main() {
  console.log("⚖️  Test-Cases — Sistema HV\n");

  // ─── 1. Setup ────────────────────────────────────────────────────────────
  console.log("1) Criando cliente de teste...");
  const cpf = String(Date.now()).slice(-11).padStart(11, "0");
  const cli = await createClient({
    full_name: "TEST-CASES " + Date.now(),
    cpf_cnpj: cpf,
    tipo: null,
    email: null,
    phone: null,
    address: null,
  });
  assert("cliente criado", !!cli.id);

  // ─── 2. Criar caso ───────────────────────────────────────────────────────
  console.log("\n2) Criar caso...");
  const caso = await createCase({
    client_id: cli.id,
    case_type: "FIES_ESF",
    proximo_passo: "Análise documental",
    responsavel: "Hyago",
    municipio: "Maceió/AL",
  });
  assert("case_code no formato esperado", /^HV-FIES-\d{4}-\d{4,}$/.test(caso.case_code));
  assert("status inicial = ONBOARDING", caso.macrostatus_op === "ONBOARDING");
  assert("proximo_passo gravado", caso.proximo_passo === "Análise documental");

  // ─── 3. Mover status ─────────────────────────────────────────────────────
  console.log("\n3) Mover status ONBOARDING → ANALISE...");
  const moved = await moveCaseStatus(caso.id, "ANALISE");
  assert("status após move = ANALISE", moved.macrostatus_op === "ANALISE");
  assert(
    "status_changed_at atualizou (trigger)",
    moved.status_changed_at !== caso.status_changed_at,
  );

  // ─── 4. Update (próximo passo) ───────────────────────────────────────────
  console.log("\n4) Editar próximo passo...");
  const upd = await updateCase(caso.id, { proximo_passo: "Confirmar dados no SISFIES" });
  assert("próximo_passo atualizado", upd.proximo_passo === "Confirmar dados no SISFIES");

  // ─── 5. Timeline ─────────────────────────────────────────────────────────
  console.log("\n5) Timeline...");
  const events = await listCaseEvents(caso.id);
  assert("3 eventos (created + status_changed + updated)", events.length === 3);
  assert("primeiro evento é o mais recente", events[0].action === "updated");

  // ─── 6. List por cliente ─────────────────────────────────────────────────
  console.log("\n6) Listar por cliente...");
  const list = await listCases({ client_id: cli.id });
  assert("1 caso visível na lista", list.length === 1);
  assert("client_name preenchido na view", list[0].client_name === cli.full_name);

  // ─── 7. List filtrada por macrostatus ────────────────────────────────────
  console.log("\n7) Listar por macrostatus...");
  const byStatus = await listCases({ macrostatus_op: "ANALISE", client_id: cli.id });
  assert(
    "encontrou pelo macrostatus",
    byStatus.some((c) => c.id === caso.id),
  );

  // ─── 8. CHECK constraint — macrostatus inválido ─────────────────────────
  console.log("\n8) Macrostatus inválido deve falhar...");
  let bad = false;
  try {
    // @ts-expect-error testando runtime
    await updateCase(caso.id, { macrostatus_op: "INVENTADO" });
  } catch (err) {
    bad = err instanceof Error;
  }
  assert("update com macrostatus_op inválido rejeitado", bad);

  // ─── 9. Get ──────────────────────────────────────────────────────────────
  console.log("\n9) Get...");
  const got = await getCase(caso.id);
  assert("get retorna case_code", got.case_code === caso.case_code);

  // ─── 10. Bifurcação automática (op → fin) ────────────────────────────────
  console.log("\n10) Bifurcação automática IMPLANTADO → ELABORANDO...");
  const caso2 = await createCase({
    client_id: cli.id,
    case_type: "FIES_DGM",
    proximo_passo: "Vai pra implantado direto",
  });
  assert("caso2 inicia com fin=NAO_APLICAVEL", caso2.macrostatus_fin === "NAO_APLICAVEL");
  const bifurcated = await moveCaseStatus(caso2.id, "IMPLANTADO");
  assert("op = IMPLANTADO", bifurcated.macrostatus_op === "IMPLANTADO");
  assert(
    "fin bifurcou automaticamente pra ELABORANDO",
    bifurcated.macrostatus_fin === "ELABORANDO",
  );
  assert(
    "status_fin_changed_at atualizou pelo trigger",
    bifurcated.status_fin_changed_at !== caso2.status_fin_changed_at,
  );

  // ─── 11. Idempotência: mover op pra IMPLANTACAO_PARCIAL não re-bifurca ──
  console.log("\n11) Idempotência: IMPLANTADO → IMPLANTACAO_PARCIAL não reseta fin...");
  await moveCaseStatusFin(caso2.id, "ATIVO");
  const idem = await moveCaseStatus(caso2.id, "IMPLANTACAO_PARCIAL");
  assert("fin permaneceu ATIVO (não voltou pra ELABORANDO)", idem.macrostatus_fin === "ATIVO");

  // ─── 12. Mover op pra trás (ANALISE) não afeta fin ──────────────────────
  console.log("\n12) Mover op pra ANALISE não toca no fin...");
  const back = await moveCaseStatus(caso2.id, "ANALISE");
  assert("fin segue ATIVO após op voltar", back.macrostatus_fin === "ATIVO");

  // ─── 13. CANCELADO no op não bifurca ─────────────────────────────────────
  console.log("\n13) CANCELADO no op não dispara bifurcação...");
  const caso3 = await createCase({
    client_id: cli.id,
    case_type: "COVID",
    proximo_passo: "Cliente desistiu",
  });
  const cancelled = await moveCaseStatus(caso3.id, "CANCELADO");
  assert("CANCELADO no op mantém fin=NAO_APLICAVEL", cancelled.macrostatus_fin === "NAO_APLICAVEL");

  // ─── 14. Bloqueio de revert pra NAO_APLICAVEL ────────────────────────────
  console.log("\n14) moveCaseStatusFin pra NAO_APLICAVEL é bloqueado...");
  let blocked = false;
  try {
    await moveCaseStatusFin(caso2.id, "NAO_APLICAVEL");
  } catch (err) {
    blocked = err instanceof Error && err.message.toLowerCase().includes("não aplicável");
  }
  assert("revert pra NAO_APLICAVEL rejeitado", blocked);

  // ─── 15. Soft-delete do caso original ────────────────────────────────────
  console.log("\n15) Soft-delete...");
  await softDeleteCase(caso.id);
  await softDeleteCase(caso2.id);
  await softDeleteCase(caso3.id);
  const after = await listCases({ client_id: cli.id });
  assert("casos somem da view active", after.length === 0);

  const eventsAfter = await listCaseEvents(caso.id);
  assert("evento soft_deleted registrado", eventsAfter[0].action === "soft_deleted");

  // ─── 16. Cleanup ─────────────────────────────────────────────────────────
  console.log("\n16) Cleanup cliente...");
  await softDeleteClient(cli.id);
  console.log("   ✓ ok\n");

  if (failed > 0) {
    console.error(`❌ ${failed} assertion(s) falhou(aram).`);
    process.exit(1);
  }
  console.log("🎉 Todos os testes de casos passaram.");
}

main().catch((err) => {
  console.error("\n❌ Falha:", err);
  process.exit(1);
});
