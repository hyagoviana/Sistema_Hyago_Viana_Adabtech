// Runner CLI da Sincronizacao do Motor de Distribuicao.
//
// Roda o MESMO nucleo do botao "Sincronizar" (src/lib/distribuicao/sync-core.runSync)
// a partir da linha de comando, com as credenciais do .env.local injetadas no
// process.env. Grava em system_distribution_results (+ batch_log) — o que acende
// o Painel/Lista da tela de Distribuicao. ZERO writeback ao ProJuris.
//
// Uso (de dentro de sistema-hv/):
//   npx tsx scripts/run-sincronizar.ts [YYYY-MM-DD] [windowDays]
//
// Ex.: npx tsx scripts/run-sincronizar.ts 2026-08-05 3

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { runSync, ymd } from "@/lib/distribuicao/sync-core";

async function main() {
  const date = process.argv[2] || ymd(new Date());
  const windowDays = process.argv[3] ? Number(process.argv[3]) : 3;

  console.log(`[sincronizar] data=${date} janela=${windowDays}d — iniciando...`);
  const t0 = Date.now();
  const s = await runSync(date, windowDays);
  const ms = Date.now() - t0;

  console.log("\n========================= RESULTADO =========================");
  console.log(`batchDate       : ${s.batchDate}`);
  console.log(`total_tarefas   : ${s.totalTasks}`);
  console.log(`distribuidas    : ${s.distributed}`);
  console.log(`bloqueadas      : ${s.blocked}`);
  console.log("\nDistribuicao por executor (tarefas | pontos):");
  for (const e of s.byExecutor) {
    console.log(`  ${e.name.padEnd(32)} ${String(e.tasks).padStart(2)} | ${e.points} pts`);
  }
  if (s.alerts.length) {
    console.log("\nAlertas (codigo: contagem):");
    for (const a of s.alerts) console.log(`  ${a.code}: ${a.count}`);
  }
  console.log(
    `\nGravado em system_distribution_results (+ batch_log). Sem writeback ao ProJuris. (${ms}ms)`,
  );
  console.log("=============================================================");
}

main().catch((err) => {
  console.error("[sincronizar] ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
