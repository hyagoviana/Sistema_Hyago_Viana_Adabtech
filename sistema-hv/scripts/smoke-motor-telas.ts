// SMOKE TEST ponta a ponta das duas etapas humanas do motor (doc 21.08).
//
// Percorre o caminho inteiro com dados REAIS, exatamente como a UI faria:
//   1. buscar no ProJuris        → system_distribution_movements (PENDENTE)
//   2. decidir "distribuir"      → system_distribution_staging  (ABERTA)
//   3. revisar uma variável      → update no staging
//   4. rodar o motor             → system_distribution_results
//
// Por padrão LIMPA tudo que criou no passo 3 e 4 (o resultado da distribuição, a
// linha do staging e a decisão do movimento voltam ao estado anterior), para não
// sujar a produção — o banco de dev É o de produção neste projeto. Passe
// `--keep` para manter e conferir pela tela.
//
// Uso (de dentro de sistema-hv/):
//   npx tsx scripts/smoke-motor-telas.ts [--keep] [YYYY-MM-DD]

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import {
  decideMovement,
  distribuirStaging,
  listMovements,
  listStaging,
  syncMovements,
  updateStagingItem,
} from "@/lib/distribuicao/staging-core";
import { listTaskTypes } from "@/lib/task-types-service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ymd } from "@/lib/distribuicao/sync-core";

const KEEP = process.argv.includes("--keep");
const DATA = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? ymd(new Date());

function passo(n: number, titulo: string) {
  console.log(`\n${"=".repeat(64)}\n${n}. ${titulo}\n${"=".repeat(64)}`);
}

async function main() {
  const sb = getSupabaseAdmin();

  // Um usuário admin real para assinar as ações (as funções exigem ator).
  const { data: ator } = await sb
    .from("system_users")
    .select("id, full_name, email")
    .eq("role", "admin")
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  if (!ator) throw new Error("Nenhum admin ativo encontrado para assinar as ações");
  console.log(`ator: ${ator.full_name ?? ator.email}`);
  console.log(`data de referência: ${DATA}`);
  console.log(`modo: ${KEEP ? "MANTER o que for criado" : "LIMPAR ao final"}`);

  // ---------------------------------------------------------------- 1
  passo(1, "TELA 1 — buscar no ProJuris (só leitura lá)");
  const resumo = await syncMovements(DATA, 3);
  console.log(
    `lidos=${resumo.lidos} · novos=${resumo.novos} · já existiam=${resumo.jaExistiam} · janela ${resumo.dataInicial} → ${resumo.dataFinal}`,
  );

  const pendentes = await listMovements({ decisao: "PENDENTE" });
  console.log(`\npendentes de análise: ${pendentes.length}`);
  for (const m of pendentes.slice(0, 5)) {
    console.log(
      `  · ${m.data_referencia ?? "?"} | ${m.numero_cnj ?? "sem CNJ"} | caso=${
        m.case_id ? "vinculado" : "—"
      } | ${(m.descricao ?? "").slice(0, 60)}`,
    );
  }
  if (pendentes.length === 0) {
    console.log("\nNada pendente — o resto do fluxo precisa de pelo menos 1 movimento.");
    return;
  }

  // ---------------------------------------------------------------- 2
  passo(2, "TELA 1 — decidir: distribuir tarefa (escolhendo o tipo)");
  const tipos = await listTaskTypes({ estado: "ativos", soMotor: true });
  console.log(`tipos disponíveis no motor: ${tipos.length}`);
  if (tipos.length === 0) throw new Error("Nenhum tipo de tarefa ativo/no motor");

  // Preferimos um movimento JÁ vinculado a um caso (é o cenário real completo).
  const alvo = pendentes.find((m) => m.case_id) ?? pendentes[0];
  const tipo = tipos[0];
  console.log(
    `movimento escolhido: ${alvo.numero_cnj ?? alvo.id} (caso ${alvo.case_id ? "vinculado" : "sem vínculo"})`,
  );
  console.log(
    `tipo escolhido: ${tipo.nome} · ${tipo.points} pts · prev/fatal ${tipo.prazo_previsto_dias ?? "·"}/${tipo.prazo_fatal_dias ?? "·"} dias`,
  );

  const { stagingId } = await decideMovement(alvo.id, "DISTRIBUIR", tipo.id, ator.id);
  console.log(`→ staging criado: ${stagingId}`);

  // ---------------------------------------------------------------- 3
  passo(3, "TELA 2 — o que o sistema pré-preencheu (e a revisão humana)");
  const abertas = await listStaging("ABERTA");
  const item = abertas.find((s) => s.id === stagingId);
  if (!item) throw new Error("A linha não apareceu na tela 2");
  console.log(
    `pontos=${item.pontos} · prevista=${item.data_prevista ?? "·"} · fatal=${item.data_fatal ?? "·"}`,
  );
  console.log(
    `coletivo=${item.coletivo} · complexo=${item.complexo} · urgente=${item.urgente} · exclusivo=${item.exclusive_executor_id ?? "—"}`,
  );

  // Simula a correção manual que o Thiago descreveu ("esse aqui eu não acho que
  // o urgente aplica").
  await updateStagingItem(item.id, { urgente: !item.urgente });
  const depois = (await listStaging("ABERTA")).find((s) => s.id === stagingId)!;
  console.log(`→ revisão manual: urgente ${item.urgente} → ${depois.urgente} (gravado)`);

  // ---------------------------------------------------------------- 4
  passo(4, "TELA 3 — rodar o motor sobre o que foi aprovado");
  const r = await distribuirStaging([item.id], ator.id, DATA);
  console.log(
    `enviadas=${r.enviadas} · distribuídas=${r.distribuidas} · bloqueadas=${r.bloqueadas}`,
  );
  for (const e of r.porExecutor) {
    const { data: u } = await sb
      .from("system_users")
      .select("full_name, email")
      .eq("id", e.executor_id)
      .maybeSingle();
    console.log(
      `  · ${u?.full_name ?? u?.email ?? e.executor_id}: ${e.tarefas} tarefa(s), ${e.pontos} pts`,
    );
  }

  const { data: results } = await sb
    .from("system_distribution_results")
    .select("task_id, executor_id, final_points, final_date, flow, alerts")
    .eq("task_id", item.id);
  console.log(`\ngravado em system_distribution_results: ${results?.length ?? 0} linha(s)`);
  for (const row of results ?? []) {
    console.log(
      `  · fluxo=${row.flow} · pontos=${row.final_points} · data final=${row.final_date} · alertas=${JSON.stringify(row.alerts)}`,
    );
  }

  // ---------------------------------------------------------------- limpeza
  if (KEEP) {
    console.log("\n--keep: nada foi desfeito. Confira pelas telas da Controladoria.");
    return;
  }

  passo(5, "LIMPEZA — desfazendo o que este teste criou");
  const del = await sb.from("system_distribution_results").delete().eq("task_id", item.id);
  console.log(`results apagados: ${del.error ? `ERRO ${del.error.message}` : "ok"}`);

  await sb.from("system_distribution_staging").delete().eq("id", item.id);
  console.log("linha do staging removida");

  await sb
    .from("system_distribution_movements")
    .update({ decisao: "PENDENTE", task_type_id: null, decidido_por: null, decidido_em: null })
    .eq("id", alvo.id);
  console.log("movimento devolvido para PENDENTE");
  console.log(
    "\nOs movimentos trazidos do ProJuris FICAM (é o estado natural da tela 1: pendentes de análise).",
  );
}

main()
  .then(() => {
    console.log("\n✅ fluxo completo executado.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
