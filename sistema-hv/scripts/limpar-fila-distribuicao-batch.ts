// REUNIÃO 31/08 — limpa da fila de distribuição ("Lista") o que o motor
// automático colocou lá: tarefas que JÁ EXISTIAM no ProJuris e nunca passaram
// pela decisão da controladoria.
//
// Preserva:
//   · tudo que veio do fluxo humano (origem='staging');
//   · tudo que a controladoria APROVOU (mesmo sendo origem='batch') — se foi
//     aprovado, virou trabalho de alguém e o histórico tem que continuar.
//
// NÃO toca no ProJuris. Só remove linhas da fila do SHV.
//
// Uso:
//   npx tsx scripts/limpar-fila-distribuicao-batch.ts          # só relatório
//   CONFIRMA=SIM npx tsx scripts/limpar-fila-distribuicao-batch.ts   # apaga
import { config } from "dotenv";

config({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";

const CONFIRMA = process.env.CONFIRMA === "SIM";

async function main() {
  const sb = getSupabaseAdmin();

  const { data: results, error } = await sb
    .from("system_distribution_results")
    .select("id, distribution_date, origem, executor_id")
    .limit(5000);
  if (error) throw new Error(error.message);

  const { data: aprovacoes } = await sb
    .from("system_distribution_approvals")
    .select("distribution_result_id, status");
  const statusPorResult = new Map(
    (aprovacoes ?? []).map((a) => [
      (a as { distribution_result_id: string }).distribution_result_id,
      (a as { status: string }).status,
    ]),
  );

  const todos = results ?? [];
  const staging = todos.filter((r) => (r as { origem?: string }).origem === "staging");
  const batch = todos.filter((r) => (r as { origem?: string }).origem !== "staging");
  const batchAprovadas = batch.filter(
    (r) => statusPorResult.get((r as { id: string }).id) === "approved",
  );
  const alvo = batch.filter((r) => statusPorResult.get((r as { id: string }).id) !== "approved");

  console.log("═══ FILA DE DISTRIBUIÇÃO (system_distribution_results) ═══\n");
  console.log(`  total de linhas .................. ${todos.length}`);
  console.log(`  do fluxo humano (staging) ........ ${staging.length}   ← preservado`);
  console.log(`  do motor automático (batch) ...... ${batch.length}`);
  console.log(`    · já aprovadas ................. ${batchAprovadas.length}   ← preservado`);
  console.log(`    · NÃO aprovadas ................ ${alvo.length}   ← seria apagado`);

  const porData = new Map<string, number>();
  for (const r of alvo) {
    const d = (r as { distribution_date: string }).distribution_date;
    porData.set(d, (porData.get(d) ?? 0) + 1);
  }
  if (porData.size) {
    console.log("\n  Por data de distribuição:");
    for (const [d, n] of [...porData.entries()].sort()) {
      console.log(`    ${d}  ${String(n).padStart(4)}`);
    }
  }

  if (!CONFIRMA) {
    console.log("\n⏸  RELATÓRIO. Nada foi apagado.");
    console.log("   Para apagar: CONFIRMA=SIM npx tsx scripts/limpar-fila-distribuicao-batch.ts");
    return;
  }
  if (alvo.length === 0) {
    console.log("\n✅ Nada a apagar.");
    return;
  }

  console.log(`\n🧹 Apagando ${alvo.length} linha(s)…`);
  const ids = alvo.map((r) => (r as { id: string }).id);
  let apagadas = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { error: delErr } = await sb.from("system_distribution_results").delete().in("id", lote);
    if (delErr) throw new Error(`Falha ao apagar: ${delErr.message}`);
    apagadas += lote.length;
  }
  console.log(`✅ ${apagadas} linha(s) removida(s) da fila. ProJuris intocado.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
