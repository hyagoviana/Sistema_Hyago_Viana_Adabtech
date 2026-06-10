// E2E do módulo Financeiro (P2) sem browser — exercita os services/DB direto.
// Cobre os P0 do S25 que NÃO dependem da fundação de auth server-side (harness de
// RPC autenticada fica para quando o ADR-015 existir). O happy-path de auto-aprovação
// NÃO é coberto aqui porque dispara geração de PDF via Google Docs (dependência externa).
//
// Uso:  npm run test:financeiro

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { createCase, softDeleteCase } from "../src/lib/cases-service";
import { createClient, softDeleteClient } from "../src/lib/clients-service";
import { getDashboardFinanceiro } from "../src/lib/financeiro-service";
import { bifurcarCaseToFinanceiro, entrarNoFinanceiro } from "../src/lib/pipeline-service";
import {
  aceitarTermo,
  calcularTermo,
  createTermo,
  darBaixaParcela,
  enviarParaConferencia,
  conferirTermo,
  estornarParcela,
  listParcelas,
  recusarTermo,
} from "../src/lib/termo-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const ELABORADOR = "11111111-1111-1111-1111-111111111111";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function expectThrows(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    assert(label, false);
  } catch {
    assert(label, true);
  }
}

async function main() {
  console.log("💰 Test-Financeiro (P2) — Sistema HV\n");
  const sb = getSupabaseAdmin();

  // ─── 1. Cálculo de bordas (função pura — PRD §9.2) ───────────────────────
  console.log("1) Calculadora — bordas...");
  const base = calcularTermo({ saldoAntesCentavos: 2000000, saldoDepoisCentavos: 0 });
  assert("total = 15% truncado (R$3.000)", base.valor_total_centavos === 300000);
  assert("qtd parcelas = 6", base.qtd_parcelas === 6);
  assert("última = 50000 (resto 0)", base.valor_ultima_parcela_centavos === 50000);
  assert("à vista = 10% desc (270000)", base.valor_avista_centavos === 270000);

  const incorpora = calcularTermo({ saldoAntesCentavos: 2033334, saldoDepoisCentavos: 0 });
  assert("resto < mínimo incorpora na última (qtd 6)", incorpora.qtd_parcelas === 6);
  assert("última incorpora resto (55000)", incorpora.valor_ultima_parcela_centavos === 55000);

  const addParcela = calcularTermo({ saldoAntesCentavos: 2133334, saldoDepoisCentavos: 0 });
  assert("resto >= mínimo vira parcela extra (qtd 7)", addParcela.qtd_parcelas === 7);
  assert("última = resto (20000)", addParcela.valor_ultima_parcela_centavos === 20000);

  const zero = calcularTermo({ saldoAntesCentavos: 0, saldoDepoisCentavos: 0 });
  assert("efetivo 0 → qtd 0", zero.qtd_parcelas === 0 && zero.valor_total_centavos === 0);

  const sub = calcularTermo({ saldoAntesCentavos: 200000, saldoDepoisCentavos: 0 });
  assert(
    "total < 1 parcela → 1 parcela com o total",
    sub.qtd_parcelas === 1 && sub.valor_ultima_parcela_centavos === 30000,
  );

  // ─── 2. Setup cliente + caso bifurcado ───────────────────────────────────
  console.log("\n2) Setup cliente + caso...");
  const cpf = String(Date.now()).slice(-11).padStart(11, "0");
  const cli = await createClient({
    full_name: "TEST-FIN " + Date.now(),
    cpf_cnpj: cpf,
    tipo: null,
    email: null,
    phone: null,
    address: null,
  });
  const caso = await createCase({
    client_id: cli.id,
    case_type: "FIES_DGM",
    proximo_passo: "teste financeiro",
  });
  assert("caso criado", !!caso.id);

  // ─── 3. Dupla bifurcação idempotente (S25-4) ─────────────────────────────
  console.log("\n3) Dupla bifurcação idempotente...");
  await entrarNoFinanceiro(caso.id, false);
  const apos1 = await sb.from("system_cases").select("macrostatus_fin").eq("id", caso.id).single();
  const finApos1 = apos1.data?.macrostatus_fin;
  assert("bifurcou para 1ª etapa fin", !!finApos1 && finApos1 !== "NAO_APLICAVEL");
  await bifurcarCaseToFinanceiro(caso.id); // função antiga
  await entrarNoFinanceiro(caso.id, false); // de novo
  const apos2 = await sb.from("system_cases").select("macrostatus_fin").eq("id", caso.id).single();
  assert(
    "estado fin inalterado após múltiplas bifurcações",
    apos2.data?.macrostatus_fin === finApos1,
  );

  // ─── 4. Segregação elaborador ≠ conferidor (S25-3, negativo) ─────────────
  console.log("\n4) Segregação (mesmo usuário não confere)...");
  const tSeg = await createTermo({
    caseId: caso.id,
    saldoAntesCentavos: 2000000,
    saldoDepoisCentavos: 0,
    elaboradoPorId: ELABORADOR,
  });
  await enviarParaConferencia(tSeg.id);
  await expectThrows("conferir pelo próprio elaborador é rejeitado (service)", () =>
    conferirTermo(tSeg.id, ELABORADOR),
  );
  await expectThrows("CHECK do banco rejeita conferido = elaborado", () =>
    sb
      .from("system_termo_snapshots")
      .update({ conferido_por_id: ELABORADOR })
      .eq("id", tSeg.id)
      .then(({ error }) => {
        if (error) throw error;
      }),
  );

  // ─── 5. Imutabilidade após aprovação (S25-2, via service_role) ───────────
  console.log("\n5) Imutabilidade do Termo aprovado (trigger, não só RLS)...");
  const tImut = await createTermo({
    caseId: caso.id,
    saldoAntesCentavos: 2000000,
    saldoDepoisCentavos: 0,
    elaboradoPorId: ELABORADOR,
  });
  // Promove direto a APROVADO_JURIDICO (RASCUNHO→APROVADO não é bloqueado).
  await sb
    .from("system_termo_snapshots")
    .update({ status: "APROVADO_JURIDICO" })
    .eq("id", tImut.id);
  await expectThrows("alterar valor de termo aprovado é bloqueado (service_role)", () =>
    sb
      .from("system_termo_snapshots")
      .update({ valor_total_centavos: 999 })
      .eq("id", tImut.id)
      .then(({ error }) => {
        if (error) throw error;
      }),
  );
  await expectThrows("apagar termo aprovado é bloqueado", () =>
    sb
      .from("system_termo_snapshots")
      .delete()
      .eq("id", tImut.id)
      .then(({ error }) => {
        if (error) throw error;
      }),
  );

  // ─── 6. RECUSADO → 0 parcelas (S25-6) ────────────────────────────────────
  console.log("\n6) RECUSADO não gera parcelas...");
  const tRec = await createTermo({
    caseId: caso.id,
    saldoAntesCentavos: 2000000,
    saldoDepoisCentavos: 0,
    elaboradoPorId: ELABORADOR,
  });
  await sb.from("system_termo_snapshots").update({ status: "APRESENTADO" }).eq("id", tRec.id);
  const recusado = await recusarTermo(tRec.id);
  assert("status = RECUSADO", recusado.status === "RECUSADO");
  const parcRec = await sb
    .from("system_parcelas")
    .select("id", { count: "exact", head: true })
    .eq("termo_id", tRec.id);
  assert("0 parcelas no termo recusado", (parcRec.count ?? 0) === 0);

  // ─── 7. À VISTA → 1 parcela (S25-6) + baixa idempotente (S22) ────────────
  console.log("\n7) À VISTA gera 1 parcela; baixa idempotente...");
  const tAvista = await createTermo({
    caseId: caso.id,
    saldoAntesCentavos: 2000000,
    saldoDepoisCentavos: 0,
    formaPagamento: "A_VISTA",
    elaboradoPorId: ELABORADOR,
  });
  await sb.from("system_termo_snapshots").update({ status: "APRESENTADO" }).eq("id", tAvista.id);
  const aceito = await aceitarTermo(tAvista.id);
  assert("aceite reporta 1 parcela gerada (à vista)", aceito.parcelas === 1);
  const parcs = (await listParcelas(caso.id)).filter((p) => p.termo_id === tAvista.id);
  assert("exatamente 1 parcela à vista", parcs.length === 1);
  assert("valor da parcela = à vista (270000)", parcs[0]?.valor_centavos === 270000);

  const parcelaId = parcs[0]!.id;
  await darBaixaParcela(parcelaId, { valorPagoCentavos: 270000, metodoPagamento: "PIX" });
  const paga = await sb.from("system_parcelas").select("status").eq("id", parcelaId).single();
  assert("parcela marcada como PAGA", paga.data?.status === "PAGA");
  await expectThrows("baixa duplicada é rejeitada (409)", () =>
    darBaixaParcela(parcelaId, { valorPagoCentavos: 270000 }),
  );
  await estornarParcela(parcelaId);
  const estornada = await sb.from("system_parcelas").select("status").eq("id", parcelaId).single();
  assert("estorno volta para PENDENTE", estornada.data?.status === "PENDENTE");

  // ─── 8. Dashboard agrega sem quebrar (S21) ───────────────────────────────
  console.log("\n8) Dashboard financeiro...");
  const dash = await getDashboardFinanceiro();
  assert("dashboard retorna números", typeof dash.recebido_centavos === "number");
  assert("contabiliza parcelas", dash.qtd_parcelas >= 1);

  // ─── 9. Cleanup ──────────────────────────────────────────────────────────
  console.log("\n9) Cleanup...");
  // Parcelas e termos não-imutáveis são removíveis; termos aprovados/aceitos ficam
  // (trigger de imutabilidade) presos ao caso soft-deletado — invisíveis no app.
  await sb.from("system_parcelas").delete().eq("case_id", caso.id);
  await softDeleteCase(caso.id);
  await softDeleteClient(cli.id);
  console.log("   ✓ ok\n");

  if (failed > 0) {
    console.error(`❌ ${failed} assertion(s) falhou(aram).`);
    process.exit(1);
  }
  console.log("🎉 Todos os testes do financeiro passaram.");
}

main().catch((err) => {
  console.error("\n❌ Falha:", err);
  process.exit(1);
});
