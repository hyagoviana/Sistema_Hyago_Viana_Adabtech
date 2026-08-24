// WRITE-BACK das ações da controladoria de volta ao ProJuris.
//
// O Thiago desenhou os botões da tela 1 como ações que valem NOS DOIS SISTEMAS
// (reunião 19/08, sobre arquivar e marcar lido: "Isso no ProJuris"). Os endpoints
// foram confirmados no WADL oficial (24/08):
//
//   PUT /intimacao/{codigo}/situacao/ARQUIVADA   → arquivar
//   PUT /intimacao/{codigo}/desarquivar          → desfazer
//   PUT /andamento/alterar-status-lido/{codigo}  → marcar lido
//
// ⚠️ Este é o PRIMEIRO ponto do sistema que ESCREVE no ProJuris de produção.
// Por isso três garantias:
//
//   1. TRAVA DE BANCO — `system_distribution_config.projuris_writeback_ativo`.
//      Nasce desligado; ligado/desligado pela tela, sem deploy.
//   2. BEST-EFFORT — falhar aqui NUNCA desfaz a decisão que a pessoa tomou no
//      SHV. O erro é registrado no movimento e a vida segue.
//   3. REVERSÍVEL — arquivar tem `desarquivar`. Foi por isso que começamos por
//      estas duas ações, e não por criar tarefa/processo.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";

/** Chave de situação aceita pelo ProJuris (enum TipoSituacaoIntimacaoType). */
const SITUACAO_ARQUIVADA = "ARQUIVADA";

export interface ResultadoWriteback {
  /** A chamada chegou a ser feita? (false quando a trava está desligada.) */
  enviado: boolean;
  /** Motivo de não ter enviado, ou a mensagem de erro. */
  motivo?: string;
}

/** Lê a trava. Qualquer dúvida ⇒ desligado (fail-closed). */
export async function isWritebackAtivo(): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_distribution_config")
    .select("projuris_writeback_ativo")
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  return data?.projuris_writeback_ativo === true;
}

/**
 * Reflete no ProJuris a decisão tomada num movimento da tela 1.
 *
 * - INTIMAÇÃO + ARQUIVADO → `PUT /intimacao/{cod}/situacao/ARQUIVADA`
 * - INTIMAÇÃO + volta para PENDENTE → `PUT /intimacao/{cod}/desarquivar`
 * - ANDAMENTO + LIDO → `PUT /andamento/alterar-status-lido/{cod}`
 * - Distribuir/qualquer outra combinação → nada a fazer lá.
 *
 * Grava o resultado no próprio movimento (`projuris_sync_at`/`_error`).
 */
export async function refletirDecisaoNoProjuris(
  movementId: string,
  decisao: "PENDENTE" | "ARQUIVADO" | "LIDO" | "DISTRIBUIR",
): Promise<ResultadoWriteback> {
  const sb = getSupabaseAdmin();

  if (!(await isWritebackAtivo()))
    return { enviado: false, motivo: "write-back ao ProJuris está desligado" };

  const { data: mov } = await sb
    .from("system_distribution_movements")
    .select("id, origem, projuris_id")
    .eq("id", movementId)
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  if (!mov) return { enviado: false, motivo: "movimento não encontrado" };

  const codigo = (mov.projuris_id ?? "").trim();
  // Só códigos numéricos são do ProJuris; iniciais do SHV usam chave própria
  // ("inicial:<uuid>") e não existem lá.
  if (!/^\d+$/.test(codigo))
    return { enviado: false, motivo: "linha sem código do ProJuris (origem interna)" };

  let rota: string | null = null;
  if (mov.origem === "INTIMACAO") {
    if (decisao === "ARQUIVADO") rota = `intimacao/${codigo}/situacao/${SITUACAO_ARQUIVADA}`;
    else if (decisao === "PENDENTE") rota = `intimacao/${codigo}/desarquivar`;
  } else if (mov.origem === "ANDAMENTO" && decisao === "LIDO") {
    rota = `andamento/alterar-status-lido/${codigo}`;
  }
  if (!rota) return { enviado: false, motivo: "esta decisão não tem reflexo no ProJuris" };

  try {
    const client = await buildProjurisClientFromConfig(sb);
    await client.authenticateTryingVariants();
    await client.projurisPut(rota, {});
    await sb
      .from("system_distribution_movements")
      .update({ projuris_sync_at: new Date().toISOString(), projuris_sync_error: null } as never)
      .eq("id", movementId);
    return { enviado: true };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    await sb
      .from("system_distribution_movements")
      .update({ projuris_sync_error: motivo.slice(0, 500) } as never)
      .eq("id", movementId);
    return { enviado: false, motivo };
  }
}
