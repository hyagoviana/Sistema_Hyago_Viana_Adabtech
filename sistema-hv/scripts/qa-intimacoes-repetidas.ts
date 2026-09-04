// QA S1-03 (04/09) — intimações repetidas do mesmo processo.
//
// Prova, contra o BANCO REAL, o fluxo que o Thiago definiu na resposta A1:
// a fila mostra UMA por processo/dia, o resto fica em stand by, e a decisão
// tomada numa vale para o grupo (as outras viram "arquivado por repetição").
//
// SOMENTE LEITURA — não decide nada, não escreve. A parte de escrita é exercida
// pelo fluxo real na tela.
//
// Rodar: npx tsx scripts/qa-intimacoes-repetidas.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { listMovements, listMovementsDoGrupo } from "../src/lib/distribuicao/staging-core";

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

  // --- toda linha tem chave de grupo ----------------------------------------
  const { data: semGrupo } = await sb
    .from("system_distribution_movements")
    .select("id")
    .is("grupo_processo_dia" as never, null)
    .limit(5);
  check(
    "toda linha tem chave de grupo (migration + ingestão)",
    (semGrupo ?? []).length === 0,
    `${(semGrupo ?? []).length} sem chave`,
  );

  // --- a fila agrupa ---------------------------------------------------------
  const agrupada = await listMovements({ decisao: "PENDENTE" });
  const completa = await listMovements({ decisao: "PENDENTE", agrupado: false });

  console.log(
    `\n  Fila PENDENTE: ${completa.length} linha(s) no banco → ${agrupada.length} exibida(s) ` +
      `(${completa.length - agrupada.length} em stand by)\n`,
  );

  check(
    "a fila agrupada não mostra mais linhas que a completa",
    agrupada.length <= completa.length,
  );
  check(
    "cada linha exibida traz a contagem do grupo",
    agrupada.every((m) => (m.repetidas ?? 0) >= 1),
  );
  check(
    "a soma das contagens bate com o total do banco",
    agrupada.reduce((acc, m) => acc + (m.repetidas ?? 1), 0) === completa.length,
    `${agrupada.reduce((acc, m) => acc + (m.repetidas ?? 1), 0)} x ${completa.length}`,
  );
  check(
    "nenhum processo aparece duas vezes na mesma data",
    new Set(agrupada.map((m) => m.grupo_processo_dia)).size === agrupada.length,
  );

  // --- o grupo é do MESMO processo (não junta processos diferentes) ----------
  const comRepeticao = agrupada.filter((m) => (m.repetidas ?? 1) > 1);
  console.log(`  Linhas que representam repetição: ${comRepeticao.length}`);
  if (comRepeticao.length > 0) {
    const exemplo = comRepeticao[0];
    const irmas = await listMovementsDoGrupo(exemplo.id);
    console.log(
      `  Exemplo: ${exemplo.numero_cnj ?? exemplo.projuris_processo_codigo ?? "?"} ` +
        `em ${exemplo.data_referencia} → ${irmas.length} intimação(ões)`,
    );
    check(
      "o grupo devolve todas as irmãs",
      irmas.length === (exemplo.repetidas ?? 1),
      `${irmas.length} x ${exemplo.repetidas}`,
    );
    check(
      "todas as irmãs são do MESMO processo e do MESMO dia",
      new Set(irmas.map((i) => i.grupo_processo_dia)).size === 1,
    );
    check(
      "as irmãs têm códigos de intimação DIFERENTES (é repetição, não duplicata de registro)",
      new Set(irmas.map((i) => i.projuris_id)).size === irmas.length,
    );
  } else {
    console.log("  (nenhuma repetição pendente hoje — o agrupamento não tinha o que reduzir)");
  }

  // --- linha sem processo identificado nunca é agrupada com outra ------------
  const { data: semProcesso } = await sb
    .from("system_distribution_movements")
    .select("id, grupo_processo_dia")
    .is("projuris_processo_codigo", null)
    .is("numero_cnj", null)
    .limit(20);
  const chavesSemProcesso = ((semProcesso ?? []) as Array<{ grupo_processo_dia: string }>).map(
    (m) => m.grupo_processo_dia,
  );
  check(
    `linha sem processo identificado tem chave própria (${chavesSemProcesso.length} conferida(s))`,
    new Set(chavesSemProcesso).size === chavesSemProcesso.length,
  );

  // --- histórico não agrupa --------------------------------------------------
  const decididas = await listMovements({ decisao: "ARQUIVADO" });
  check(
    "telas de decisão já tomada não agrupam (auditoria vê tudo)",
    decididas.every((m) => m.repetidas === undefined),
  );

  if (falhou) {
    console.error(`\nINTIMAÇÕES REPETIDAS: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nINTIMAÇÕES REPETIDAS: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
