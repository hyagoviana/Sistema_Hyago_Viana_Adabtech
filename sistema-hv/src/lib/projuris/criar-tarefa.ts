// Espelha no ProJuris a tarefa que a controladoria distribuiu no SHV.
//
// É o último elo do motor. Sem ele, a tela 2 decide quem faz o quê e a decisão
// morre aqui dentro: quem executa trabalha no ProJuris e nunca fica sabendo.
// Com ele, a controladoria continua decidindo no SHV e a tarefa aparece na fila
// da pessoa lá, com prazo, tipo e responsável já preenchidos.
//
// CONTRATO — extraído do `ns1.xsd` da documentação oficial (baixado em 24/08),
// tipo `tarefaWs` do `POST /tarefa`. Vale registrar o desenho, porque não é
// óbvio: a tarefa é um ENVELOPE (`tarefaWs`) com o conteúdo dentro de
// `tarefaEventoWs`, e o vínculo com o processo NÃO é um campo — é uma entrada
// na lista `modulos`, no formato { modulo, codigoRegistroVinculo, vinculoPrincipal }.
// Dois detalhes que o XSD NÃO conta, e que só apareceram lendo uma tarefa real
// pelo `GET /tarefa-compromisso/{cod}`:
//   · `modulo` vai em MAIÚSCULAS ("PROCESSO") — o XSD aponta para o enum
//     `moduloType`, minúsculo, mas o que a API devolve e aceita é o
//     `moduloTarefaType`, maiúsculo;
//   · as DATAS são epoch em MILISSEGUNDOS (number), não "YYYY-MM-DD". Mandar a
//     string devolve HTTP 500 genérico, sem dizer qual campo está errado.
//
// E três campos que o XSD marca como opcionais mas a API EXIGE — descobertos um
// a um, porque a validação (HTTP 412) reclama de um por vez:
//   `dataBase`, `dataLimite` e `tarefaEventoSituacaoWs`.
//
// Como em todo write-back deste sistema, três garantias (ver writeback-acoes.ts):
// trava de banco, best-effort e registro do erro na própria linha.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { projurisSituacaoDoStatus } from "./task-situacao";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";
import { isWritebackAtivo } from "@/lib/projuris/writeback-acoes";

export interface ResultadoCriacaoTarefa {
  /** Chegou a chamar o ProJuris? (false quando a trava está desligada.) */
  enviado: boolean;
  /** codigoTarefaEvento devolvido por lá. */
  codigo?: string;
  /** Por que não enviou, ou o que deu errado. */
  motivo?: string;
}

/**
 * Converte "YYYY-MM-DD" no epoch em MILISSEGUNDOS que o ProJuris espera.
 *
 * Ancora ao MEIO-DIA UTC de propósito: à meia-noite, o fuso de Brasília (-03)
 * joga a data para o dia anterior, e um prazo que vence dia 26 chegaria lá como
 * dia 25.
 */
function comoData(v: string | null | undefined): number | null {
  if (!v) return null;
  const d = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const ms = Date.parse(`${d}T12:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Monta o corpo do `POST /tarefa` a partir de uma linha do staging, ou explica
 * por que ela ainda não pode virar tarefa lá.
 *
 * Separado do envio de propósito: assim dá para conferir exatamente o que seria
 * mandado — em produção de terceiro, olhar antes de escrever vale muito.
 */
export async function montarPayloadTarefa(
  stagingId: string,
): Promise<{ corpo: Record<string, unknown> } | { impedimento: string }> {
  const sb = getSupabaseAdmin();

  const { data: linha } = await sb
    .from("system_distribution_staging")
    // Uma string literal só: o tipo do retorno é inferido do texto do select, e
    // uma concatenação faz o Supabase perder a inferência.
    .select(
      "id, case_id, movement_id, task_type_id, numero_cnj, cliente_nome, data_prevista, data_fatal, urgente, status, projuris_codigo_tarefa",
    )
    .eq("id", stagingId)
    .eq("organization_id", ORG_ID)
    .maybeSingle();

  if (!linha) return { impedimento: "linha não encontrada" };
  if (linha.projuris_codigo_tarefa)
    return { impedimento: `já espelhada (tarefa ${linha.projuris_codigo_tarefa} no ProJuris)` };
  if (linha.status !== "DISTRIBUIDA") return { impedimento: "só espelha depois de distribuir" };

  // ---- de quem é a tarefa -------------------------------------------------
  //
  // O executor sai do resultado do motor (mesma tabela do batch automático), e o
  // código do usuário no ProJuris vem do mapeamento que já existe desde a
  // Story 4.2. Sem mapeamento não há para quem mandar — e mandar sem responsável
  // criaria uma tarefa órfã lá, pior do que não criar.
  const { data: resultado } = await sb
    .from("system_distribution_results")
    .select("executor_id")
    .eq("task_id", stagingId)
    .eq("organization_id", ORG_ID)
    .maybeSingle();

  if (!resultado?.executor_id) return { impedimento: "sem executor definido para esta tarefa" };

  const { data: mapa } = await sb
    .from("system_projuris_executor_mapping")
    .select("projuris_responsavel_id")
    .eq("executor_id", resultado.executor_id)
    .eq("organization_id", ORG_ID)
    .eq("active", true)
    .maybeSingle();

  const codigoResponsavel = Number(mapa?.projuris_responsavel_id);
  if (!Number.isFinite(codigoResponsavel) || codigoResponsavel <= 0)
    return { impedimento: "o executor não tem usuário correspondente no ProJuris" };

  // ---- em que processo ela entra -----------------------------------------
  //
  // Um caso pode ter vários processos (o principal e os recursos, cada um com
  // andamento próprio — Thiago, 24/08). A tarefa tem de nascer NAQUELE que gerou
  // o andamento, senão o recurso vira tarefa no processo de origem e some da
  // vista de quem acompanha o recurso.
  //
  // O movimento que originou esta linha já sabe de que processo veio. Só quando
  // não há movimento (inicial mandada pela ficha do caso) caímos no principal.
  const { data: movimento } = linha.movement_id
    ? await sb
        .from("system_distribution_movements")
        .select("projuris_processo_codigo")
        .eq("id", linha.movement_id)
        .maybeSingle()
    : { data: null };

  let codigoProcesso = Number(movimento?.projuris_processo_codigo);

  if (!Number.isFinite(codigoProcesso) || codigoProcesso <= 0) {
    const { data: caso } = linha.case_id
      ? await sb
          .from("system_cases")
          .select("projuris_codigo_processo")
          .eq("id", linha.case_id)
          .maybeSingle()
      : { data: null };
    codigoProcesso = Number(caso?.projuris_codigo_processo);
  }

  if (!Number.isFinite(codigoProcesso) || codigoProcesso <= 0)
    return { impedimento: "o caso não está vinculado a um processo do ProJuris" };

  // ---- que tipo de tarefa é ----------------------------------------------
  const { data: tipo } = linha.task_type_id
    ? await sb
        .from("system_task_type_mapping")
        .select("projuris_tipo_codigo, projuris_tipo_descricao, motor_task_type_id")
        .eq("id", linha.task_type_id)
        .maybeSingle()
    : { data: null };

  const codigoTipo = Number(tipo?.projuris_tipo_codigo);
  if (!Number.isFinite(codigoTipo) || codigoTipo <= 0)
    return { impedimento: "o tipo de tarefa ainda não existe no ProJuris" };

  const nomeTipo = tipo?.projuris_tipo_descricao || tipo?.motor_task_type_id || "Tarefa";

  // ---- prazos -------------------------------------------------------------
  //
  // Quando a tela 2 não preencheu, cai para HOJE — é melhor uma tarefa com prazo
  // apertado e visível do que uma recusa silenciosa do outro lado.
  //
  // `dataLimite` é o prazo FATAL para o ProJuris. Sem fatal definido aqui, o
  // previsto faz esse papel: deixar em branco faz a API recusar (412).
  const hoje = comoData(new Date().toISOString());
  const prevista = comoData(linha.data_prevista) ?? hoje;
  const fatal = comoData(linha.data_fatal) ?? prevista;

  const vinculo = {
    modulo: "PROCESSO", // maiúsculo: é o que a API devolve e aceita
    codigoRegistroVinculo: codigoProcesso,
    vinculoPrincipal: true,
  };

  const descricao = [
    nomeTipo,
    linha.cliente_nome ? "Cliente: " + linha.cliente_nome : null,
    linha.numero_cnj ? "Processo: " + linha.numero_cnj : null,
    linha.urgente ? "URGENTE" : null,
    "Distribuída pela controladoria (SHV).",
  ]
    .filter(Boolean)
    .join("\n");

  const corpo = {
    modulos: [vinculo],
    compromisso: false,
    // Rastro: permite reconhecer lá que a tarefa nasceu no SHV, e reencontrá-la
    // por este código se o codigoTarefaEvento não voltar na resposta.
    codigoExterno: linha.id,
    tarefaEventoWs: {
      modulos: [vinculo],
      titulo: nomeTipo,
      descricaoTarefa: descricao,
      dataConclusaoPrevista: prevista,
      dataLimite: fatal,
      // Data a partir da qual o ProJuris conta o prazo do tipo.
      dataBase: prevista,
      // Situação: obrigatória (sem ela a API recusa com
      // erro.tarefa.situacao.naoInformada). O de-para com o vocabulário do SHV
      // vive em `task-situacao.ts`. A linha chega aqui recém-distribuída, então
      // na prática sai sempre como pendente — mas o mapeamento é explícito para
      // não virar número mágico quando a escrita de volta evoluir.
      tarefaEventoSituacaoWs: projurisSituacaoDoStatus(null),
      tipoTarefa: { chave: codigoTipo, valor: nomeTipo },
      usuariosResponsaveis: [{ chave: codigoResponsavel }],
    },
  };

  return { corpo };
}

/**
 * Cria no ProJuris a tarefa correspondente a uma linha JÁ DISTRIBUÍDA da tela 2.
 *
 * Idempotente: se a linha já tem `projuris_codigo_tarefa`, não cria de novo.
 */
export async function criarTarefaNoProjuris(stagingId: string): Promise<ResultadoCriacaoTarefa> {
  const sb = getSupabaseAdmin();

  if (!(await isWritebackAtivo()))
    return { enviado: false, motivo: "escrita no ProJuris está desligada" };

  const montado = await montarPayloadTarefa(stagingId);
  if ("impedimento" in montado) return { enviado: false, motivo: montado.impedimento };

  let resposta: unknown;
  try {
    resposta = await postTarefa(montado.corpo);
  } catch (err) {
    const motivo = (err instanceof Error ? err.message : String(err)).slice(0, 400);
    await sb
      .from("system_distribution_staging")
      .update({ projuris_sync_error: motivo, projuris_sync_at: new Date().toISOString() } as never)
      .eq("id", stagingId);
    return { enviado: true, motivo };
  }

  const codigo = extraiCodigoTarefa(resposta);

  const { error } = await sb
    .from("system_distribution_staging")
    .update({
      projuris_codigo_tarefa: codigo,
      projuris_sync_at: new Date().toISOString(),
      projuris_sync_error: null,
    } as never)
    .eq("id", stagingId);

  if (error)
    return {
      enviado: true,
      codigo: codigo ?? undefined,
      motivo: "criada no ProJuris, mas o código não foi salvo aqui: " + error.message,
    };

  return codigo
    ? { enviado: true, codigo }
    : { enviado: true, motivo: "criada no ProJuris, mas o código não voltou na resposta" };
}

/** Isola a chamada HTTP — o transporte é o mesmo POST autenticado do client. */
async function postTarefa(corpo: unknown): Promise<unknown> {
  const client = await buildProjurisClientFromConfig(getSupabaseAdmin());
  await client.authenticateTryingVariants();
  return client.projurisPostConsulta<unknown>("tarefa", corpo);
}

/**
 * Tira o código da resposta da criação.
 *
 * O `POST /tarefa` responde `{ "chave": 58344160, "valor": "TAR.0042163" }` —
 * `chave` é o codigoTarefaEvento (confirmado na sonda de 24/08: esse número
 * abre a tarefa no `GET /tarefa-compromisso/{cod}`) e `valor` é o identificador
 * que a pessoa vê. Os outros nomes ficam como rede, porque endpoints vizinhos
 * respondem o objeto inteiro.
 */
export function extraiCodigoTarefa(resposta: unknown): string | null {
  if (resposta == null) return null;
  if (typeof resposta === "number") return String(resposta);
  if (typeof resposta !== "object") return null;

  const chaves = ["codigoTarefaEvento", "codigoTarefa", "codigo", "chave", "id"];
  const olha = (o: Record<string, unknown>): string | null => {
    for (const k of chaves) {
      if (o[k] != null && /^\d+$/.test(String(o[k]))) return String(o[k]);
    }
    return null;
  };

  const o = resposta as Record<string, unknown>;
  const direto = olha(o);
  if (direto) return direto;

  for (const filho of ["tarefaEventoWs", "tarefaWs"]) {
    const sub = o[filho];
    if (sub && typeof sub === "object") {
      const achou = olha(sub as Record<string, unknown>);
      if (achou) return achou;
    }
  }
  return null;
}
