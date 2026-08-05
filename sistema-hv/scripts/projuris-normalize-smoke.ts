// Smoke SÓ-LEITURA do normalizador de intimações (story A9, T3).
//
// Roda normalizeIntimacoes() nos últimos 7 dias (amostra ~10) e imprime os
// registros normalizados — para VER o TEMA-CANDIDATO real (assunto / marcadores
// / campos personalizados do PROCESSO) e o tipo-de-tarefa + prazos das TAREFAS
// reais. Isso ajuda o Thiago a confirmar ONDE o tema SHV mora.
//
// SÓ LEITURA (GET + POST /consulta). Nada é gravado no ProJuris nem no banco.
//
//   npx tsx --env-file=.env.local scripts/projuris-normalize-smoke.ts

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";
import { normalizeIntimacoes } from "../src/lib/projuris/normalizer.js";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function msToStr(ms: number | null): string {
  return ms === null ? "—" : new Date(ms).toISOString().slice(0, 10);
}

async function main() {
  console.log("=== ProJuris — NORMALIZE SMOKE (SÓ LEITURA) ===\n");
  const pj = createProjurisClientFromEnv();
  const { username } = await pj.authenticateTryingVariants();
  console.log(`Auth OK (username="${username}").`);

  const hoje = new Date();
  const seteAtras = new Date(hoje.getTime() - 7 * 86_400_000);
  const di = ymd(seteAtras);
  const df = ymd(hoje);
  console.log(`Consultando intimações ${di} → ${df} (DISPONIBILIZAÇÃO), amostra 10...\n`);

  const { totalRegistros, itens } = await normalizeIntimacoes(pj, di, df, { limit: 10 });
  console.log(`totalRegistros no período = ${totalRegistros}; normalizadas = ${itens.length}\n`);

  itens.forEach((it, i) => {
    console.log(
      `── [${i + 1}] intimação ${it.codigoIntimacao} | processo ${it.numeroProcesso} (cod ${it.codigoProcesso})`,
    );
    console.log(
      `   responsável: ${it.responsavel_nome ?? "?"} (cod ${it.responsavel_cod ?? "?"})  | disponibilização: ${msToStr(it.data_disponibilizacao)}`,
    );
    console.log(
      `   TIPO TAREFA: ${it.tipo_tarefa_codigo ?? "—"} "${it.tipo_tarefa_nome ?? "—"}"  (${it._tarefas_no_processo} tarefa(s) no processo)`,
    );
    console.log(
      `   PRAZO previsto: ${it.prazo_previsto ?? "—"} dia(s) (${msToStr(it.prazo_previsto_data)})  | fatal: ${it.prazo_fatal ?? "—"} dia(s) (${msToStr(it.prazo_fatal_data)})`,
    );
    console.log(`   TEMA resolvido (heurística atual): ${it.tema_resolvido ?? "—"}`);
    console.log(`   TEMA candidatos:`);
    console.log(`       assunto        = ${JSON.stringify(it.tema_candidatos.assunto)}`);
    console.log(`       assuntoCnj     = ${JSON.stringify(it.tema_candidatos.assuntoCnj)}`);
    console.log(`       marcadores     = ${JSON.stringify(it.tema_candidatos.marcadores)}`);
    const campos = it.tema_candidatos.camposPersonalizados;
    if (campos.length) {
      console.log(`       camposPersonalizados (${campos.length}):`);
      for (const c of campos) {
        console.log(
          `         - [${c.codigoCampoDinamico ?? "?"}] "${c.nome ?? "?"}" (${c.tipo ?? "?"}) = ${JSON.stringify(c.valor)}`,
        );
      }
    } else {
      console.log(`       camposPersonalizados = []`);
    }
    if (it.alerts.length) console.log(`   ⚠ alerts: ${it.alerts.join(" | ")}`);
    console.log();
  });

  console.log("=== FIM (nenhuma escrita). O de-para de TEMA depende de o Thiago confirmar ===");
  console.log("    em qual balde o tema SHV mora: assunto | marcador | campo personalizado.");
}

main().catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
