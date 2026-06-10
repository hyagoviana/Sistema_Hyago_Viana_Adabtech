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
import { entrarNoFinanceiro, voltarAoOperacional } from "../src/lib/pipeline-service";

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

  // ─── 8. Pipelines configuráveis: macrostatus_op não tem mais CHECK fixo ──
  //   A migration de pipelines por tipo (0021) removeu o CHECK de enum — o estado
  //   passou a ser validado pela projeção stage_op_id, não por constraint. Aqui só
  //   garantimos que mover para uma etapa configurada é aceito (e restaura o caso).
  console.log("\n8) macrostatus_op livre (CHECK removido — pipelines configuráveis)...");
  const livre = await updateCase(caso.id, { macrostatus_op: "ONBOARDING" });
  assert("update para etapa configurada aceito", livre.macrostatus_op === "ONBOARDING");

  // ─── 9. Get ──────────────────────────────────────────────────────────────
  console.log("\n9) Get...");
  const got = await getCase(caso.id);
  assert("get retorna case_code", got.case_code === caso.case_code);

  // ─── 10. S19/D2: bifurcação automática DESLIGADA ─────────────────────────
  console.log("\n10) Trigger desligado: op → IMPLANTADO NÃO bifurca mais...");
  const caso2 = await createCase({
    client_id: cli.id,
    case_type: "FIES_DGM",
    proximo_passo: "Entra no financeiro só pelo botão",
  });
  assert("caso2 inicia com fin=NAO_APLICAVEL", caso2.macrostatus_fin === "NAO_APLICAVEL");
  const naoBifurca = await moveCaseStatus(caso2.id, "IMPLANTADO");
  assert("op = IMPLANTADO", naoBifurca.macrostatus_op === "IMPLANTADO");
  assert(
    "fin permanece NAO_APLICAVEL (entrada agora é manual)",
    naoBifurca.macrostatus_fin === "NAO_APLICAVEL",
  );

  // ─── 11. S19: entrada manual "Duplicar" → 1ª etapa fin, segue no op ──────
  console.log("\n11) Entrada manual (Duplicar) leva à 1ª etapa fin...");
  await entrarNoFinanceiro(caso2.id, false);
  const dup = await getCase(caso2.id);
  assert("fin saiu de NAO_APLICAVEL (1ª etapa fin)", dup.macrostatus_fin !== "NAO_APLICAVEL");
  assert(
    "duplicar NÃO remove do operacional",
    !(dup as { removido_do_operacional_at?: string | null }).removido_do_operacional_at,
  );

  // ─── 12. Idempotência: chamar entrar de novo não reseta nem duplica ─────
  console.log("\n12) Entrada idempotente (2ª chamada não muda o estado fin)...");
  const finAntes = dup.macrostatus_fin;
  await entrarNoFinanceiro(caso2.id, false);
  const idem = await getCase(caso2.id);
  assert("fin inalterado na 2ª chamada", idem.macrostatus_fin === finAntes);

  // ─── 13. S19: "Somente financeiro" + reverter ───────────────────────────
  console.log("\n13) Somente financeiro remove do op; reverter devolve sem mexer no fin...");
  const caso3 = await createCase({
    client_id: cli.id,
    case_type: "COVID",
    proximo_passo: "Vai direto pro financeiro",
  });
  await entrarNoFinanceiro(caso3.id, true);
  const so = await getCase(caso3.id);
  assert("fin bifurcado", so.macrostatus_fin !== "NAO_APLICAVEL");
  assert(
    "removido_do_operacional_at setado",
    !!(so as { removido_do_operacional_at?: string | null }).removido_do_operacional_at,
  );
  const finSo = so.macrostatus_fin;
  await voltarAoOperacional(caso3.id);
  const rev = await getCase(caso3.id);
  assert(
    "reverter limpou a flag (volta ao operacional)",
    !(rev as { removido_do_operacional_at?: string | null }).removido_do_operacional_at,
  );
  assert("reverter NÃO mexeu no estado financeiro", rev.macrostatus_fin === finSo);

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
