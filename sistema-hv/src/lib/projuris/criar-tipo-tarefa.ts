// Criar no ProJuris um tipo de tarefa que nasceu no SHV (bloco A7 do doc 21.08).
//
// O Thiago pediu isso na reunião de 19/08, e já respondeu as decisões de projeto:
//   • módulos: "pode colocar, marcar tudo. Quando for criar, não tem problema não
//     (...) pode colocar para criar de tudo, todos os módulos."
//   • demais campos: "eles botam para preencher essa tanta coisa aqui. A gente não
//     vai preencher isso aqui tudo, não. Deixa aí sem (...) e funciona."
//
// Contrato descoberto por sondagem (o servidor valida com 412 ANTES de criar, e
// diz o que falta). Obrigatórios além do nome:
//   tipoClassificacao · filaTrabalho · tipoContagemPrazo
//
// Em vez de inventar valores para esses três, COPIAMOS de um tipo que já existe
// lá — assim o tipo novo nasce coerente com a configuração do escritório.
//
// ⚠️ ESCRITA REAL no ProJuris: passa pela mesma trava de banco do resto
// (`projuris_writeback_ativo`) e só roda por ação explícita de uma pessoa.

import { AuthError } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";
import { isWritebackAtivo } from "@/lib/projuris/writeback-acoes";

export interface ResultadoCriacaoTipo {
  criado: boolean;
  codigo?: string;
  motivo?: string;
}

/** Um valor {chave, valor} como o ProJuris usa nos campos de domínio. */
type ChaveValor = { chave: unknown; valor: unknown };

/**
 * Cria o tipo no ProJuris e grava o código devolvido no catálogo do SHV.
 *
 * Idempotente na prática: se o tipo já tem código numérico, não faz nada — o
 * vínculo já existe.
 */
export async function criarTipoNoProjuris(taskTypeId: string): Promise<ResultadoCriacaoTipo> {
  const sb = getSupabaseAdmin();

  if (!(await isWritebackAtivo()))
    return { criado: false, motivo: "escrita no ProJuris está desligada (Configurações do motor)" };

  const { data: tipo } = await sb
    .from("system_task_type_mapping")
    .select(
      "id, projuris_tipo_codigo, projuris_tipo_descricao, motor_task_type_id, prazo_previsto_dias, prazo_fatal_dias, sync_projuris",
    )
    .eq("id", taskTypeId)
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  if (!tipo) throw new AuthError("Tipo de tarefa não encontrado", 404);

  if (/^\d+$/.test(String(tipo.projuris_tipo_codigo ?? "")))
    return {
      criado: false,
      motivo: "este tipo já existe no ProJuris",
      codigo: tipo.projuris_tipo_codigo!,
    };

  if (tipo.sync_projuris === false)
    return { criado: false, motivo: 'este tipo está marcado como "só no SHV"' };

  const nome = (tipo.projuris_tipo_descricao || tipo.motor_task_type_id || "").trim();
  if (!nome) throw new AuthError("O tipo precisa de um nome antes de ir para o ProJuris", 400);

  const client = await buildProjurisClientFromConfig(sb);
  await client.authenticateTryingVariants();

  // Referência: um tipo que já existe lá, para herdar classificação, fila de
  // trabalho, contagem de prazo e a lista de módulos que o escritório usa.
  const consulta = await client.projurisPostConsulta<{
    tarefaTipoConsultaWs?: Array<Record<string, unknown>>;
  }>("tarefa-tipo/consulta", { quantidadeRegistros: 1, registroInicial: 0 });
  const codigoRef = consulta.tarefaTipoConsultaWs?.[0]?.codigoTarefaTipo;
  if (codigoRef == null)
    throw new AuthError("Não foi possível ler um tipo de referência no ProJuris", 502);

  const ref = await client.projurisGet<Record<string, unknown>>(`tarefa-tipo/${codigoRef}`);

  const corpo: Record<string, unknown> = {
    nomeTipoTarefa: nome,
    // Os três obrigatórios, herdados da configuração real do escritório.
    tipoClassificacao: ref.tipoClassificacao ?? "TAREFA",
    filaTrabalho: ref.filaTrabalho,
    tipoContagemPrazo: ref.tipoContagemPrazo,
    // "pode colocar para criar de tudo, todos os módulos" (Thiago, 19/08).
    modulos: (ref.modulos as ChaveValor[] | undefined) ?? [],
    tipoPrazo: ref.tipoPrazo,
    // Prazos do SHV — o motivo de o tipo existir aqui.
    prazoPadrao: tipo.prazo_previsto_dias ?? 0,
    prazoFatal: tipo.prazo_fatal_dias ?? 0,
    habilitado: true,
  };

  let resposta: unknown;
  try {
    resposta = await client.projurisPostConsulta<unknown>("tarefa-tipo", corpo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 412 = validação do ProJuris; a mensagem lista o que falta.
    throw new AuthError(`O ProJuris recusou a criação: ${msg.slice(0, 300)}`, 422);
  }

  // O código pode vir no corpo ou só existir depois — buscamos por nome se preciso.
  const codigo = extraiCodigo(resposta) ?? (await procuraCodigoPorNome(client, nome));
  if (!codigo)
    return {
      criado: true,
      motivo: 'criado no ProJuris, mas o código não voltou — rode "Sincronizar do ProJuris"',
    };

  const { error } = await sb
    .from("system_task_type_mapping")
    .update({ projuris_tipo_codigo: codigo } as never)
    .eq("id", taskTypeId)
    .eq("organization_id", ORG_ID);
  if (error)
    return {
      criado: true,
      codigo,
      motivo: `criado no ProJuris (código ${codigo}), mas o vínculo não foi salvo: ${error.message}`,
    };

  return { criado: true, codigo };
}

function extraiCodigo(resposta: unknown): string | null {
  if (resposta == null) return null;
  if (typeof resposta === "number") return String(resposta);
  if (typeof resposta === "object") {
    const o = resposta as Record<string, unknown>;
    for (const k of ["codigoTarefaTipo", "codigo", "chave", "id"]) {
      if (o[k] != null && /^\d+$/.test(String(o[k]))) return String(o[k]);
    }
  }
  return null;
}

/** Fallback: acha o tipo recém-criado pelo nome exato. */
async function procuraCodigoPorNome(
  client: {
    projurisPostConsulta: <T>(
      p: string,
      b: unknown,
      q?: Record<string, string | number>,
    ) => Promise<T>;
  },
  nome: string,
): Promise<string | null> {
  const r = await client.projurisPostConsulta<{
    tarefaTipoConsultaWs?: Array<Record<string, unknown>>;
  }>("tarefa-tipo/consulta", { quantidadeRegistros: 1000, registroInicial: 0 });
  const alvo = (r.tarefaTipoConsultaWs ?? []).find(
    (t) =>
      String(t.nomeTipoTarefa ?? "")
        .trim()
        .toUpperCase() === nome.toUpperCase(),
  );
  return alvo?.codigoTarefaTipo != null ? String(alvo.codigoTarefaTipo) : null;
}
