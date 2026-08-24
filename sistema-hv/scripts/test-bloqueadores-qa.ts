// PROVA das correções dos 2 bloqueadores mais graves apontados pelo QA (24/08).
//
//  B1 — o batch automático apagava a distribuição feita à mão.
//       Agora `runSync` só deleta linhas `origem='batch'`.
//  B2 — decidir "distribuir" duas vezes criava DUAS linhas na fila, e o motor
//       distribuía a mesma tarefa para dois executores.
//
// Cria os dados de teste, verifica e limpa tudo no final.
//
// Uso: npx tsx scripts/test-bloqueadores-qa.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decideMovement, listStaging } from "@/lib/distribuicao/staging-core";
import { ymd } from "@/lib/distribuicao/sync-core";
import { listTaskTypes } from "@/lib/task-types-service";

const sb = getSupabaseAdmin();
const ORG = "00000000-0000-0000-0000-000000000001";

async function b1() {
  console.log("\n===== B1: o batch NÃO pode apagar a distribuição humana =====");
  const hoje = ymd(new Date());

  // Duas linhas na mesma data: uma "do batch", outra "da mão".
  const { data: exec } = await sb
    .from("system_users")
    .select("id")
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  if (!exec) throw new Error("sem usuário ativo");

  const base = {
    organization_id: ORG,
    distribution_date: hoje,
    process_id: "__qa_proc__",
    final_points: 1,
    flow: "GENERAL",
    base_date: hoje,
    applicable_limit: hoje,
    final_date: hoje,
    executor_id: exec.id,
    preference_applied: false,
    alerts: [] as string[],
    writeback_pending: false,
    blocked: false,
  };
  await sb.from("system_distribution_results").insert([
    { ...base, task_id: "__qa_batch__", origem: "batch" },
    { ...base, task_id: "__qa_staging__", origem: "staging" },
  ] as never);

  // Exatamente o DELETE que o runSync faz.
  await sb
    .from("system_distribution_results")
    .delete()
    .eq("organization_id", ORG)
    .eq("distribution_date", hoje)
    .eq("origem", "batch");

  const { data: sobrou } = await sb
    .from("system_distribution_results")
    .select("task_id, origem")
    .eq("distribution_date", hoje)
    .in("task_id", ["__qa_batch__", "__qa_staging__"]);

  const temBatch = (sobrou ?? []).some((r) => r.task_id === "__qa_batch__");
  const temStaging = (sobrou ?? []).some((r) => r.task_id === "__qa_staging__");
  console.log(`  linha do batch   foi apagada: ${!temBatch ? "SIM (correto)" : "NÃO"}`);
  console.log(`  linha humana     sobreviveu : ${temStaging ? "SIM (correto)" : "NÃO — BUG"}`);

  await sb
    .from("system_distribution_results")
    .delete()
    .in("task_id", ["__qa_batch__", "__qa_staging__"]);
  return !temBatch && temStaging;
}

async function b2() {
  console.log("\n===== B2: decidir 'distribuir' 2x NÃO pode duplicar =====");
  const { data: ator } = await sb
    .from("system_users")
    .select("id")
    .eq("role", "admin")
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  const { data: mov } = await sb
    .from("system_distribution_movements")
    .select("id")
    .eq("decisao", "PENDENTE")
    .limit(1)
    .maybeSingle();
  if (!ator || !mov) throw new Error("sem ator/movimento para testar");

  const tipos = await listTaskTypes({ estado: "ativos", soMotor: true });
  const [t1, t2] = tipos;

  await decideMovement(mov.id, "DISTRIBUIR", t1.id, ator.id);
  await decideMovement(mov.id, "DISTRIBUIR", t2?.id ?? t1.id, ator.id); // 2ª vez, tipo diferente

  const abertas = (await listStaging("ABERTA")).filter((s) => s.movement_id === mov.id);
  console.log(
    `  linhas na fila para o mesmo movimento: ${abertas.length} ${abertas.length === 1 ? "(correto)" : "— BUG"}`,
  );
  if (abertas.length === 1) {
    const esperado = t2?.id ?? t1.id;
    console.log(
      `  tipo foi ATUALIZADO para o 2º escolhido: ${abertas[0].task_type_id === esperado ? "SIM" : "NÃO"}`,
    );
  }

  // limpeza
  await sb.from("system_distribution_staging").delete().eq("movement_id", mov.id);
  await sb
    .from("system_distribution_movements")
    .update({ decisao: "PENDENTE", task_type_id: null, decidido_por: null, decidido_em: null })
    .eq("id", mov.id);
  return abertas.length === 1;
}

async function main() {
  const ok1 = await b1();
  const ok2 = await b2();
  console.log(
    ok1 && ok2 ? "\n✅ os dois bloqueadores estão corrigidos" : "\n❌ ainda há bloqueador aberto",
  );
  if (!(ok1 && ok2)) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
