// QA da S3-04 — visão 360 do cliente.
//
// O risco desta story é o número DIVERGIR: a ficha do cliente passa a somar
// receitas e despesas por conta própria, e se a régua não for exatamente a
// mesma da aba Financeiro do caso, os dois lugares mostram valores diferentes
// para o mesmo caso. Ninguém descobre isso lendo o código — descobre quando o
// cliente aponta.
//
// Por isso o teste central compara, caso a caso e com dados REAIS, o que a ficha
// mostra contra o que `resumoFinanceiroCaso` (a fonte da aba) devolve.
//
// SOMENTE LEITURA.
//
// Rodar: npx tsx scripts/qa-s304-visao-360.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";

import { agregarParcelas, getClientOverview } from "../src/lib/client-overview-service";
import { resumoFinanceiroCaso } from "../src/lib/financeiro-caso-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

async function main() {
  const sb = getSupabaseAdmin();

  // ================================================= a régua é literalmente uma
  console.log("\n  A — a régua de valores é compartilhada, não copiada\n");

  const servico = readFileSync("src/lib/financeiro-caso-service.ts", "utf8");
  check(
    "resumoFinanceiroCaso usa `agregarParcelas` (não uma segunda cópia da conta)",
    servico.includes("agregarParcelas(e.installments)"),
  );
  check(
    "a contagem antiga foi removida do serviço do caso",
    !servico.includes('if (p.status === "CANCELADA") continue;'),
  );

  // Régua isolada: parcela cancelada não conta em nada; vencida é derivada da data.
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const r = agregarParcelas([
    { status: "PAGA", data_vencimento: ontem, valor_centavos: 1000, valor_pago_centavos: 900 },
    { status: "AGUARDANDO", data_vencimento: ontem, valor_centavos: 2000 },
    { status: "AGUARDANDO", data_vencimento: amanha, valor_centavos: 3000 },
    { status: "CANCELADA", data_vencimento: ontem, valor_centavos: 9999 },
  ]);
  check("devido soma tudo menos cancelada", r.devido_centavos === 6000, String(r.devido_centavos));
  check("pago usa o valor PAGO, não o previsto", r.pago_centavos === 900, String(r.pago_centavos));
  check(
    "aguardando com vencimento passado vira VENCIDA",
    r.vencido_centavos === 2000,
    String(r.vencido_centavos),
  );
  check("a vencer fica com o resto", r.vincendo_centavos === 3000, String(r.vincendo_centavos));
  check("cancelada não entra em nenhuma fatia", r.devido_centavos === 6000);

  // ============================================ a ficha bate com a aba do caso
  console.log("\n  B — os números da ficha batem com os da aba Financeiro\n");

  // Um cliente que tenha caso COM lançamento — é onde a divergência apareceria.
  const { data: entryRaw } = await sb
    .from("system_case_fin_entries")
    .select("case_id")
    .is("deleted_at", null)
    .limit(50);
  const caseIds = [
    ...new Set(((entryRaw ?? []) as Array<{ case_id: string }>).map((e) => e.case_id)),
  ];

  if (!caseIds.length) {
    console.log("  (nenhum lançamento financeiro no banco — pulando a comparação)");
  } else {
    const { data: casosRaw } = await sb
      .from("system_cases")
      .select("id, client_id")
      .in("id", caseIds)
      .not("client_id", "is", null)
      .is("deleted_at", null);
    const casos = (casosRaw ?? []) as Array<{ id: string; client_id: string }>;
    const clientIds = [...new Set(casos.map((c) => c.client_id))].slice(0, 5);

    let comparados = 0;
    for (const clientId of clientIds) {
      const overview = await getClientOverview(clientId);
      for (const c of overview.casos) {
        const resumo = await resumoFinanceiroCaso(c.id);
        const esperado = { receitas: 0, despesas: 0, pagoR: 0, pagoD: 0 };
        for (const linha of resumo) {
          if (linha.kind === "DESPESA") {
            esperado.despesas += linha.devido_centavos;
            esperado.pagoD += linha.recebido_centavos;
          } else {
            esperado.receitas += linha.devido_centavos;
            esperado.pagoR += linha.recebido_centavos;
          }
        }
        if (!esperado.receitas && !esperado.despesas) continue;
        comparados++;

        check(
          `${c.case_code ?? c.id.slice(0, 8)} — receitas batem`,
          c.receitas.devido_centavos === esperado.receitas,
          `ficha ${c.receitas.devido_centavos} × aba ${esperado.receitas}`,
        );
        check(
          `${c.case_code ?? c.id.slice(0, 8)} — despesas batem`,
          c.despesas.devido_centavos === esperado.despesas,
          `ficha ${c.despesas.devido_centavos} × aba ${esperado.despesas}`,
        );
        check(
          `${c.case_code ?? c.id.slice(0, 8)} — recebido bate`,
          c.receitas.pago_centavos === esperado.pagoR,
          `ficha ${c.receitas.pago_centavos} × aba ${esperado.pagoR}`,
        );
      }

      // O total do cliente é a soma dos casos — AC3.
      const somaCasos = overview.casos.reduce((acc, c) => acc + c.receitas.devido_centavos, 0);
      check(
        "o total do cliente é a soma exata dos casos",
        overview.totalReceitas.devido_centavos === somaCasos,
        `${overview.totalReceitas.devido_centavos} × ${somaCasos}`,
      );
    }
    console.log(`  (${comparados} caso(s) com valor comparado(s) contra a aba Financeiro)`);
  }

  // ======================================================== etapas traduzidas
  console.log("\n  C — as etapas saem traduzidas, não como slug\n");

  const { data: comEtapa } = await sb
    .from("system_cases_active")
    .select("client_id")
    .not("client_id", "is", null)
    .not("macrostatus_op", "is", null)
    .limit(1)
    .maybeSingle();
  const cli = (comEtapa as { client_id: string } | null)?.client_id;
  if (cli) {
    const ov = await getClientOverview(cli);
    const comOp = ov.casos.filter((c) => c.etapa_operacional);
    check("há etapa operacional resolvida", comOp.length > 0);
    // Slug tem underscore ou é MAIÚSCULO; rótulo humano não costuma ser assim.
    // Este é o bug 3 do Thiago (04/09) reaparecendo em outra tela.
    const crus = comOp.filter((c) => /^[A-Z_]+$/.test(c.etapa_operacional!));
    check(
      "nenhuma etapa saiu como slug cru",
      crus.length === 0,
      crus.map((c) => `${c.case_code}: ${c.etapa_operacional}`).join(", "),
    );
  }

  // ===================================================== gate e ordem da página
  console.log("\n  D — gate de valores e ordem da ficha\n");

  const rpc = readFileSync("src/rpc/client-overview.ts", "utf8");
  check(
    "o gate ZERA no servidor (o valor não viaja no payload)",
    rpc.includes("podeVerValores: false as const") && rpc.includes("receitas: ZERO"),
  );
  check("quem não vê valores ainda recebe os casos", rpc.includes("casos: overview.casos.map"));

  const ficha = readFileSync("src/routes/clientes.$id.tsx", "utf8");
  check("a ilha financeira saiu da ficha", !ficha.includes("<ClientFinanceiroSection"));
  check(
    "o selo binário continua para quem não vê valores",
    ficha.includes("ClientPaymentStatusSeal"),
  );

  const iCasos = ficha.indexOf("<ClientCasesSection");
  const iNotas = ficha.indexOf('<NotesBlock target="client"');
  const iDocs = ficha.indexOf("<ClientDocumentsSection");
  check("ordem do desenho: casos → notas → documentos", iCasos < iNotas && iNotas < iDocs);

  if (falhou) {
    console.error(`\nS3-04: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nS3-04: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
