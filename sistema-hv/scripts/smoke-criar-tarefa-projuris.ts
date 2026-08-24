// Confere o espelho de tarefas no ProJuris ANTES de escrever lá.
//
// A criação de tarefa é diferente das outras escritas que já ligamos: arquivar
// tem `desarquivar`, marcar lido é inócuo — mas o WADL não expõe DELETE de
// tarefa. O que for criado, fica. Por isso este script existe em três degraus:
//
//   (sem flag)   mostra a fila e o corpo exato que SERIA enviado — não escreve
//   --enviar     cria de verdade UMA linha (a mais recente sem espelho)
//   --enviar-todas  processa a fila inteira
//
// Uso:
//   npx tsx scripts/smoke-criar-tarefa-projuris.ts
//   npx tsx scripts/smoke-criar-tarefa-projuris.ts --enviar

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ORG_ID } from "@/lib/distribuicao/sync-core";
import { montarPayloadTarefa, criarTarefaNoProjuris } from "@/lib/projuris/criar-tarefa";
import { isWritebackAtivo } from "@/lib/projuris/writeback-acoes";

const ENVIAR = process.argv.includes("--enviar");
const TODAS = process.argv.includes("--enviar-todas");

async function main() {
  const sb = getSupabaseAdmin();

  const ativo = await isWritebackAtivo();
  console.log(`escrita no ProJuris: ${ativo ? "LIGADA" : "desligada"}\n`);

  const { data: fila } = await sb
    .from("system_distribution_staging")
    .select(
      "id, cliente_nome, numero_cnj, distribuido_em, projuris_codigo_tarefa, projuris_sync_error",
    )
    .eq("organization_id", ORG_ID)
    .eq("status", "DISTRIBUIDA")
    .order("distribuido_em", { ascending: false })
    .limit(50);

  const linhas = fila ?? [];
  const semEspelho = linhas.filter((l) => !l.projuris_codigo_tarefa);

  console.log(`distribuídas (últimas 50): ${linhas.length}`);
  console.log(`  já no ProJuris : ${linhas.length - semEspelho.length}`);
  console.log(`  sem espelho    : ${semEspelho.length}\n`);

  if (!semEspelho.length) {
    console.log("nada na fila de espelho.");
    return;
  }

  // ---- degrau 1: mostrar o que seria enviado -------------------------------
  const amostra = semEspelho[0];
  console.log("=".repeat(68));
  console.log(`amostra: ${amostra.cliente_nome ?? "(sem cliente)"} · ${amostra.numero_cnj ?? "-"}`);
  console.log("=".repeat(68));

  const montado = await montarPayloadTarefa(amostra.id);
  if ("impedimento" in montado) {
    console.log(`  não dá para espelhar: ${montado.impedimento}`);
  } else {
    console.log(JSON.stringify(montado.corpo, null, 2));
  }

  // Quantas da fila estão prontas, e o que barra as demais.
  const motivos = new Map<string, number>();
  let prontas = 0;
  for (const l of semEspelho) {
    const m = await montarPayloadTarefa(l.id);
    if ("impedimento" in m) motivos.set(m.impedimento, (motivos.get(m.impedimento) ?? 0) + 1);
    else prontas += 1;
  }
  console.log(`\nprontas para espelhar: ${prontas} de ${semEspelho.length}`);
  for (const [m, n] of [...motivos].sort((a, b) => b[1] - a[1])) console.log(`  ${n}x  ${m}`);

  if (!ENVIAR && !TODAS) {
    console.log("\n(nada foi enviado — rode com --enviar para criar UMA no ProJuris)");
    return;
  }

  // ---- degraus 2 e 3: escrever de verdade ----------------------------------
  const alvos = TODAS ? semEspelho : semEspelho.slice(0, 1);
  console.log(`\nenviando ${alvos.length}…`);
  for (const l of alvos) {
    const r = await criarTarefaNoProjuris(l.id);
    const rotulo = (l.cliente_nome ?? l.id).slice(0, 40).padEnd(40);
    if (r.codigo) console.log(`  OK  ${rotulo} tarefa ${r.codigo}`);
    else console.log(`  --  ${rotulo} ${r.motivo ?? "sem código"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
