// Espelha no ProJuris a conclusão feita no SHV.
//
// Pedido do Thiago (27/08), confirmado pelo owner: "a ideia é concluir a tarefa
// no sistema ao invés do ProJuris, e se possível espelhar no ProJuris a
// conclusão".
//
// A REGRA, que também responde ao receio dele sobre gente sem usuário no
// ProJuris: só espelha a tarefa que tem `projuris_codigo_tarefa`, ou seja, a que
// NASCEU lá. Tarefa criada na ficha do caso continua vivendo só aqui — não vai,
// não tenta ir, não dá erro.
//
// ⚠️ POR QUE ESTE CÓDIGO LÊ DE VOLTA. O `PUT /tarefas-situacao` responde **204
// para qualquer corpo**, inclusive `{}` e campos com nome errado, sem alterar
// nada (comprovado em 27/08 — ver `docs/referencia-api-projuris.md`). Tratar 204
// como sucesso seria construir uma falha silenciosa. Por isso toda escrita é
// seguida de uma leitura de confirmação, e o resultado fica gravado na tarefa.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createProjurisClientFromEnv, type ProjurisClient } from "@/lib/projuris/client";
import { projurisSituacaoDoStatus } from "@/lib/projuris/task-situacao";

/** Resultado de uma tentativa de espelho. Nunca lança: o chamador decide. */
export type EspelhoResultado =
  | { espelhado: true; situacao: number }
  | { espelhado: false; motivo: string };

/**
 * Lê a situação atual de uma tarefa no ProJuris.
 *
 * `GET /tarefa-compromisso/{codigoTarefaEvento}` é a ÚNICA rota que localiza uma
 * tarefa pelo código: a consulta paginada ignora filtros e devolve a página
 * inteira, e `GET /tarefa/{cod}` não existe (404).
 */
export async function lerSituacaoNoProjuris(
  client: ProjurisClient,
  codigoTarefaEvento: string,
): Promise<number | null> {
  const r = (await client
    .projurisGet(`tarefa-compromisso/${codigoTarefaEvento}`)
    .catch(() => null)) as {
    tarefaEventoWs?: { tarefaEventoSituacaoWs?: { codigoTarefaEventoSituacao?: unknown } };
  } | null;
  const cod = r?.tarefaEventoWs?.tarefaEventoSituacaoWs?.codigoTarefaEventoSituacao;
  return typeof cod === "number" ? cod : null;
}

/** A trava de banco que o owner pediu em 24/08: nasce OFF, liga na Configuração. */
async function writebackLigado(): Promise<boolean> {
  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("system_distribution_config")
    .select("projuris_writeback_ativo")
    .maybeSingle();
  return Boolean(data?.projuris_writeback_ativo);
}

/**
 * Espelha a situação de UMA tarefa do SHV no ProJuris.
 *
 * Best-effort por desenho: qualquer impedimento vira `{ espelhado: false }` com
 * motivo legível, nunca exceção — concluir a tarefa aqui não pode falhar porque
 * o ProJuris está fora do ar.
 */
export async function espelharSituacaoDaTarefa(taskId: string): Promise<EspelhoResultado> {
  const sb = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tarefa } = await (sb as any)
    .from("system_case_tasks")
    .select("id, status, projuris_codigo_tarefa")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tarefa) return { espelhado: false, motivo: "tarefa não encontrada" };

  const codigo = (tarefa.projuris_codigo_tarefa as string | null) ?? null;
  // O caso normal, não um erro: a maioria das tarefas só existe no SHV.
  if (!codigo) return { espelhado: false, motivo: "tarefa só existe no SHV" };

  if (!(await writebackLigado())) {
    return { espelhado: false, motivo: "escrita no ProJuris está desligada" };
  }

  const alvo = projurisSituacaoDoStatus(tarefa.status as string | null);
  const client = createProjurisClientFromEnv();

  try {
    await client.authenticateTryingVariants();

    const antes = await lerSituacaoNoProjuris(client, codigo);

    // A tarefa sumiu de lá (excluída, ou o código está errado). Escrever aqui
    // devolveria um 500 com HTML cru — melhor dizer o que houve de fato.
    if (antes === null) {
      const motivo = `a tarefa ${codigo} não foi encontrada no ProJuris`;
      await marcarSync(taskId, motivo);
      return { espelhado: false, motivo };
    }

    // Já está no estado desejado? Não escreve à toa.
    if (antes === alvo.codigoTarefaEventoSituacao) {
      await marcarSync(taskId, null);
      return { espelhado: true, situacao: alvo.codigoTarefaEventoSituacao };
    }

    await client.projurisPut("tarefas-situacao", {
      codigosTarefaEvento: [Number(codigo)],
      codigoSituacao: alvo.codigoTarefaEventoSituacao,
    });

    // A confirmação. Sem ela o 204 não vale nada.
    const depois = await lerSituacaoNoProjuris(client, codigo);
    if (depois !== alvo.codigoTarefaEventoSituacao) {
      const motivo = `ProJuris aceitou mas não alterou (esperado ${alvo.codigoTarefaEventoSituacao}, está ${depois ?? "?"})`;
      await marcarSync(taskId, motivo);
      return { espelhado: false, motivo };
    }

    await marcarSync(taskId, null);
    return { espelhado: true, situacao: alvo.codigoTarefaEventoSituacao };
  } catch (err) {
    const motivo = mensagemLegivel(err);
    await marcarSync(taskId, motivo);
    return { espelhado: false, motivo };
  }
}

/**
 * O ProJuris responde erro com página HTML ("<html>…Internal Server Error…"),
 * e esse texto acaba num aviso de tela. Traduz para algo que a pessoa entenda,
 * sem esconder o código de status de quem for investigar.
 */
function mensagemLegivel(err: unknown): string {
  const cru = err instanceof Error ? err.message : String(err);
  const status = cru.match(/HTTP (\d{3})/)?.[1];
  if (status === "401" || status === "403") return "o ProJuris recusou o acesso (login expirado?)";
  if (status && status.startsWith("5")) return `o ProJuris respondeu com erro (${status})`;
  if (/fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(cru)) {
    return "não foi possível falar com o ProJuris agora";
  }
  // Sem padrão conhecido: devolve o texto, mas sem a sopa de HTML.
  return cru
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Carimba o resultado na tarefa. `erro=null` limpa a pendência anterior. */
async function marcarSync(taskId: string, erro: string | null): Promise<void> {
  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any)
    .from("system_case_tasks")
    .update({
      projuris_sync_at: erro ? null : new Date().toISOString(),
      projuris_sync_error: erro,
    })
    .eq("id", taskId)
    .then(
      () => {},
      () => {},
    );
}
