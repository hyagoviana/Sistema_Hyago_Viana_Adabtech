// Prova de ponta a ponta do espelho de conclusão SHV → ProJuris (2026-08-27).
//
// O que faz: cria uma tarefa TEMPORÁRIA no SHV apontando para uma tarefa real de
// TESTE do ProJuris (58497726, criada pelo próprio motor), conclui pelo caminho
// de produção (`setCaseTaskStatus`), confere lendo do ProJuris, e no fim REVERTE
// tudo: apaga a tarefa do SHV e devolve a situação original lá.
//
// Uso: npx tsx scripts/test-espelho-situacao.ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server.js";
import { setCaseTaskStatus } from "../src/lib/dossie-service.js";
import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";
import { lerSituacaoNoProjuris } from "../src/lib/projuris/espelhar-situacao.js";

const COD_EVENTO = "58497726";
const ORG = "00000000-0000-0000-0000-000000000001";

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  const original = await lerSituacaoNoProjuris(client, COD_EVENTO);
  console.log(`ProJuris — situação original da tarefa ${COD_EVENTO}: ${original}`);

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, case_code")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!caso) return console.log("Nenhum caso disponível — abortando.");

  const { data: nova, error } = await sb
    .from("system_case_tasks")
    .insert({
      case_id: caso.id,
      organization_id: ORG,
      title: "[TESTE ESPELHO] apagar",
      status: "EM_ANDAMENTO",
      projuris_codigo_tarefa: COD_EVENTO,
    })
    .select("id")
    .single();
  if (error) return console.log("Falha ao criar tarefa de teste:", error.message);
  console.log(`Tarefa de teste criada no SHV (caso ${caso.case_code}).`);

  try {
    // O caminho de produção: é exatamente o que a tela chama.
    const r = await setCaseTaskStatus(nova.id, "CONCLUIDA_SEM_SUCESSO");
    const esp = (r as { espelho?: { espelhado: boolean; motivo?: string; situacao?: number } })
      .espelho;
    console.log(`\nRetorno do espelho: ${JSON.stringify(esp)}`);

    const agora = await lerSituacaoNoProjuris(client, COD_EVENTO);
    console.log(`ProJuris agora: ${agora} (esperado 3 = Concluída sem sucesso)`);
    console.log(agora === 3 ? "\n✅ ESPELHO FUNCIONA" : "\n❌ não refletiu");

    const { data: fim } = await sb
      .from("system_case_tasks")
      .select("projuris_sync_at, projuris_sync_error")
      .eq("id", nova.id)
      .maybeSingle();
    console.log(`Carimbo na tarefa: ${JSON.stringify(fim)}`);
  } finally {
    await sb.from("system_case_tasks").delete().eq("id", nova.id);
    if (original != null) {
      await client.projurisPut("tarefas-situacao", {
        codigosTarefaEvento: [Number(COD_EVENTO)],
        codigoSituacao: original,
      });
      const volta = await lerSituacaoNoProjuris(client, COD_EVENTO);
      console.log(`\nLimpeza: tarefa de teste apagada; ProJuris de volta em ${volta}.`);
    }
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
