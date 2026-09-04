// MOTOR DE DISTRIBUIÇÃO — as duas etapas HUMANAS (doc "21.08 _ Controladoria").
//
// O motor que já roda em produção vai do ProJuris direto para a distribuição.
// O Thiago pediu o contrário: que uma pessoa decida no meio do caminho.
//
//   "Buscamos um processo automatizado, e não automático."
//
// Fluxo desenhado por ele:
//
//   TELA 1 (movements)  lista crua do ProJuris — intimações e andamentos do dia.
//                       A pessoa abre o processo e decide, linha a linha:
//                       arquivar · marcar lido · distribuir tarefa (e qual tipo).
//
//   TELA 2 (staging)    só o que ela mandou distribuir. O sistema pré-preenche
//                       TODAS as variáveis do motor (tema, coletivo, complexo,
//                       urgente, exclusivo, datas, pontos) e ela pode trocar
//                       qualquer uma na mão.
//
//   TELA 3 (distribuir) aí sim o motor roda e lança nas agendas.
//
// NADA aqui altera o `runSync` que roda no cron. Este módulo é um caminho
// PARALELO que termina na mesma função pura do motor (`distributeBatch`) e na
// mesma tabela de resultados. A leitura de executores/calendário é própria (e
// enxuta) de propósito: mexer no sync-core significaria mexer no que está no ar.

import { AuthError } from "@/lib/supabase/auth-guard";
import { criarTarefaNoProjuris } from "@/lib/projuris/criar-tarefa";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { distributeBatch } from "@/lib/distribuicao/engine/motor";
import { buildBatchInput } from "@/lib/distribuicao/engine/transformer";
import type {
  CalendarDay,
  Executor,
  PreferenceHistory,
  Process,
  QueueState,
  Task,
} from "@/lib/distribuicao/engine/types";
import {
  ORG_ID,
  addDaysIso,
  buildProjurisClientFromConfig,
  ymd,
} from "@/lib/distribuicao/sync-core";
import { refletirDecisaoNoProjuris } from "@/lib/projuris/writeback-acoes";
import { carregarResponsaveisDirecionados } from "@/lib/distribuicao/responsavel-caso";

// ---------------------------------------------------------------------------
// Tipos expostos à UI
// ---------------------------------------------------------------------------

export type MovementDecisao =
  | "PENDENTE"
  | "ARQUIVADO"
  | "LIDO"
  | "DISTRIBUIR"
  // S1-03 — arquivada JUNTO com outra intimação do mesmo processo no mesmo dia.
  // Não é o mesmo que ARQUIVADO: ninguém leu esta linha uma a uma.
  | "ARQUIVADO_REPETICAO";

export interface Movement {
  id: string;
  origem: string;
  projuris_id: string | null;
  projuris_processo_codigo: string | null;
  numero_cnj: string | null;
  descricao: string | null;
  cliente_nome: string | null;
  data_referencia: string | null;
  case_id: string | null;
  tema_id: string | null;
  decisao: MovementDecisao;
  task_type_id: string | null;
  decidido_em: string | null;
  situacao_projuris: string | null;
  client_id: string | null;
  projuris_sync_at: string | null;
  projuris_sync_error: string | null;
  /** S1-03 — chave "processo + dia" que agrupa as repetidas. */
  grupo_processo_dia?: string | null;
  /**
   * S1-03 — quantas intimações/andamentos do MESMO processo, no MESMO dia, esta
   * linha representa (1 = não há repetição). A fila mostra só a primeira; as
   * outras ficam "em stand by" e são arquivadas junto com a decisão.
   */
  repetidas?: number;
}

export interface StagingItem {
  id: string;
  movement_id: string | null;
  case_id: string | null;
  tema_id: string | null;
  task_type_id: string | null;
  numero_cnj: string | null;
  cliente_nome: string | null;
  coletivo: boolean;
  complexo: boolean;
  urgente: boolean;
  exclusive_executor_id: string | null;
  data_prevista: string | null;
  data_fatal: string | null;
  pontos: number | null;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// TELA 1 — trazer do ProJuris o que está pendente de análise
// ---------------------------------------------------------------------------

export interface SyncMovementsSummary {
  lidos: number;
  novos: number;
  jaExistiam: number;
  /** Intimações descartadas/duplicadas no ProJuris (lixo — nunca entram na fila). */
  ignoradas: number;
  dataInicial: string;
  dataFinal: string;
}

/**
 * Puxa as intimações do ProJuris na janela [data - windowDays, data] e registra
 * cada uma como um movimento PENDENTE. Idempotente: a UNIQUE (org, origem,
 * projuris_id) impede duplicar, e um movimento já decidido não volta a PENDENTE.
 *
 * SÓ LEITURA no ProJuris.
 */
export async function syncMovements(
  distributionDate: string,
  windowDays = 3,
): Promise<SyncMovementsSummary> {
  const supabase = getSupabaseAdmin();
  const client = await buildProjurisClientFromConfig(supabase);
  await client.authenticateTryingVariants();

  const start = addDaysIso(distributionDate, -windowDays);
  const resp = await client.projurisPostConsulta<{
    intimacaoConsultaWs?: Array<Record<string, unknown>>;
  }>("intimacao/consulta", {
    tipoDataFiltroIntimacao: "DATA_DA_DISPONIBILIZACAO",
    dataPeriodoInicial: start,
    dataPeriodoFinal: distributionDate,
    dadosOrigemFiltro: true,
  });
  const intimacoes = resp.intimacaoConsultaWs ?? [];

  // Movimentações/andamentos do mesmo período (a outra metade do que o doc pede).
  const andamentos = await buscarAndamentosDoPeriodo(client, start, distributionDate);

  // ---- de-para processo → caso ----------------------------------------
  // Duas portas: o espelho judicial (system_case_judicial_processos) e os campos
  // do próprio caso. DESCOBERTA do teste de 24/08: hoje NENHUM dos 411 casos tem
  // qualquer um dos dois preenchido, então na prática o casamento acontece pelo
  // NOME DO CLIENTE (terceira porta, abaixo).
  const [judRes, casosRes] = await Promise.all([
    supabase
      .from("system_case_judicial_processos")
      .select("case_id, projuris_codigo_processo, numero_processo")
      .eq("organization_id", ORG_ID),
    supabase
      .from("system_cases")
      .select("id, tema_id, client_id, projuris_codigo_processo, projuris_numero_processo")
      .is("deleted_at", null),
  ]);

  const soDigitos = (v: string) => v.replace(/[^0-9]/g, "");
  const casoPorCodigo = new Map<string, string>();
  const casoPorCnj = new Map<string, string>();
  const temaPorCaso = new Map<string, string | null>();
  // Cliente → casos dele. Só vinculamos o caso quando não há ambiguidade.
  const casosPorCliente = new Map<string, string[]>();

  for (const j of judRes.data ?? []) {
    if (j.projuris_codigo_processo != null)
      casoPorCodigo.set(String(j.projuris_codigo_processo), j.case_id);
    if (j.numero_processo) casoPorCnj.set(soDigitos(j.numero_processo), j.case_id);
  }
  for (const c of casosRes.data ?? []) {
    temaPorCaso.set(c.id, c.tema_id ?? null);
    if (c.projuris_codigo_processo != null)
      casoPorCodigo.set(String(c.projuris_codigo_processo), c.id);
    if (c.projuris_numero_processo) casoPorCnj.set(soDigitos(c.projuris_numero_processo), c.id);
    if (c.client_id) {
      const arr = casosPorCliente.get(c.client_id) ?? [];
      arr.push(c.id);
      casosPorCliente.set(c.client_id, arr);
    }
  }

  // Clientes por nome normalizado (o payload traz nomeCliente como ARRAY).
  const { data: clientes } = await supabase
    .from("system_clients")
    .select("id, full_name")
    .is("deleted_at", null);
  const clientePorNome = new Map<string, string>();
  for (const c of clientes ?? []) {
    if (c.full_name) clientePorNome.set(c.full_name.trim().toUpperCase(), c.id);
  }

  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  /**
   * epoch (ms) → data YYYY-MM-DD no fuso de Brasília. Com `toISOString` a data
   * sairia em UTC, e uma intimação disponibilizada às 21h cairia no dia
   * seguinte — sumindo do filtro por data que a controladoria usa.
   */
  const dataBrasilia = (ms: number): string =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));

  // O teor da intimação vem em `texto`, com marcações <destaque> do ProJuris.
  const limpaTexto = (v: unknown): string | null => {
    const t = str(v);
    if (!t) return null;
    return t
      .replace(/<[^>]+>/g, "")
      .replace(/[ ]+/g, " ")
      .trim();
  };

  /**
   * S1-03 (A1, Thiago 04/09) — chave "processo + dia". É por ela que a fila
   * mostra UMA intimação por processo no dia, em vez de repetir a mesma leitura.
   *
   * Sem processo identificado, a linha vira seu PRÓPRIO grupo (usa o projuris_id):
   * agrupar o que não sabemos ser o mesmo processo esconderia trabalho de verdade.
   * Precisa casar com a expressão da migration 20260904000001.
   */
  const chaveGrupo = (
    codigoProcesso: string | null,
    cnj: string | null,
    dia: string | null,
    fallback: string,
  ): string => {
    const processo = codigoProcesso || soDigitos(cnj ?? "") || fallback;
    return `${processo}|${dia ?? "sem-data"}`;
  };

  // O doc pede a fila "sem o que já foi arquivado/baixado". Só que no ProJuris
  // deles TUDO está arquivado (15.243 de 15.245 em 180 dias; PENDENTE = 0), o
  // que deixaria a fila vazia. Então descartamos só o que é lixo de verdade
  // (descartada/duplicada) e guardamos a situação — a tela filtra o resto.
  let ignoradasPorSituacao = 0;
  const linhas: Array<Record<string, unknown>> = [];

  for (const x of intimacoes) {
    const situacao = str(x.tipoSituacao)?.toUpperCase() ?? null;
    if (x.descartada === true || x.duplicada === true) {
      ignoradasPorSituacao++;
      continue;
    }

    const codigo = x.codigoProcesso != null ? String(x.codigoProcesso) : null;
    const cnj = str(x.numeroProcesso);

    // Cliente: primeiro nome do array que casar com alguém do cadastro.
    const nomes = Array.isArray(x.nomeCliente) ? (x.nomeCliente as unknown[]) : [];
    const nomeCliente = nomes.find((n): n is string => typeof n === "string" && !!n.trim()) ?? null;
    const clientId = nomeCliente
      ? (clientePorNome.get(nomeCliente.trim().toUpperCase()) ?? null)
      : null;

    // Caso: processo (código/CNJ) e, na falta, o cliente com UM caso só.
    let caseId =
      (codigo ? casoPorCodigo.get(codigo) : undefined) ??
      (cnj ? casoPorCnj.get(soDigitos(cnj)) : undefined) ??
      null;
    if (!caseId && clientId) {
      const doCliente = casosPorCliente.get(clientId) ?? [];
      if (doCliente.length === 1) caseId = doCliente[0];
    }

    const identificador = str(x.identificador);
    const teor = limpaTexto(x.texto);
    const meio = str(x.tipoIntimacao);

    // Aprende o de-para processo→caso: se esta intimação casou pelo NOME do
    // cliente e trouxe o código do processo, os ANDAMENTOS desse mesmo processo
    // (que só têm o código) passam a casar também. Vale só para esta execução —
    // não gravamos a inferência no cadastro.
    if (caseId && codigo && !casoPorCodigo.has(codigo)) casoPorCodigo.set(codigo, caseId);

    linhas.push({
      organization_id: ORG_ID,
      origem: "INTIMACAO",
      projuris_id:
        str(x.codigoIntimacao) ??
        (x.codigoIntimacao != null ? String(x.codigoIntimacao) : null) ??
        identificador ??
        `${codigo ?? "?"}-${cnj ?? "?"}`,
      projuris_processo_codigo: codigo,
      numero_cnj: cnj,
      descricao:
        [identificador, meio].filter(Boolean).join(" · ") + (teor ? `\n${teor.slice(0, 400)}` : ""),
      cliente_nome: nomeCliente,
      client_id: clientId,
      situacao_projuris: situacao,
      data_referencia:
        typeof x.dataDisponibilizacao === "number"
          ? dataBrasilia(x.dataDisponibilizacao)
          : distributionDate,
      raw: x as never,
      case_id: caseId,
      tema_id: caseId ? (temaPorCaso.get(caseId) ?? null) : null,
      grupo_processo_dia: chaveGrupo(
        codigo,
        cnj,
        typeof x.dataDisponibilizacao === "number"
          ? dataBrasilia(x.dataDisponibilizacao)
          : distributionDate,
        str(x.codigoIntimacao) ?? identificador ?? distributionDate,
      ),
    });
  }

  // ---- ANDAMENTOS (mesma fila, mesma decisão humana) --------------------
  for (const a of andamentos) {
    const codigoProcesso = a.codigoRegistroVinculo != null ? String(a.codigoRegistroVinculo) : null;

    const caseId = (codigoProcesso ? casoPorCodigo.get(codigoProcesso) : undefined) ?? null;
    // Andamento não traz nome de cliente; o vínculo é sempre pelo processo.
    const tipo = str(a.nomeTipoAndamento);
    const teor = limpaTexto(a.descricaoAndamento);
    const identificador = str(a.identificador);

    linhas.push({
      organization_id: ORG_ID,
      origem: "ANDAMENTO",
      projuris_id: a.codigoAndamento != null ? String(a.codigoAndamento) : identificador,
      projuris_processo_codigo: codigoProcesso,
      numero_cnj: null,
      descricao:
        [identificador, tipo].filter(Boolean).join(" · ") + (teor ? `\n${teor.slice(0, 400)}` : ""),
      cliente_nome: null,
      client_id: null,
      // O andamento não tem "situação" como a intimação; o que existe é `lido`,
      // que a consulta em lote devolve nulo. Fica sem situação — e por isso o
      // filtro de arquivadas precisa aceitar NULL (ver listMovements).
      situacao_projuris: null,
      data_referencia:
        typeof a.dataAndamento === "number" ? dataBrasilia(a.dataAndamento) : distributionDate,
      raw: a as never,
      case_id: caseId,
      tema_id: caseId ? (temaPorCaso.get(caseId) ?? null) : null,
      // S1-03 — andamento também agrupa por processo + dia: o retrabalho de
      // leitura que o Thiago descreveu vale para os dois tipos de linha.
      grupo_processo_dia: chaveGrupo(
        codigoProcesso,
        null,
        typeof a.dataAndamento === "number" ? dataBrasilia(a.dataAndamento) : distributionDate,
        (a.codigoAndamento != null ? String(a.codigoAndamento) : identificador) ?? distributionDate,
      ),
    });
  }

  let novos = 0;
  for (let k = 0; k < linhas.length; k += 100) {
    const chunk = linhas.slice(k, k + 100);
    // ignoreDuplicates: um movimento já registrado (e talvez já decidido) NÃO
    // pode ser sobrescrito por uma nova varredura.
    const { data, error } = await supabase
      .from("system_distribution_movements")
      .upsert(chunk as never, {
        onConflict: "organization_id,origem,projuris_id",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new AuthError(`Falha ao gravar movimentos: ${error.message}`, 500);
    novos += data?.length ?? 0;
  }

  return {
    lidos: intimacoes.length + andamentos.length,
    novos,
    jaExistiam: linhas.length - novos,
    ignoradas: ignoradasPorSituacao,
    dataInicial: start,
    dataFinal: distributionDate,
  };
}

/**
 * "Distribuir inicial judicial" (doc 21.08, menu Judicial da ficha do caso).
 *
 * O caso manda uma INICIAL para a fila de análise da controladoria: a linha
 * aparece na Tela 1 junto com as intimações do ProJuris, e segue o mesmo
 * caminho (decisão → revisão → motor). Idempotente por caso enquanto a linha
 * anterior ainda estiver PENDENTE — clicar duas vezes não duplica.
 */
export async function enviarInicialParaDistribuicao(
  caseId: string,
  userId: string,
): Promise<{ movementId: string; jaExistia: boolean }> {
  const supabase = getSupabaseAdmin();

  const { data: caso } = await supabase
    .from("system_cases")
    .select("id, case_code, tema_id, client_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!caso) throw new AuthError("Caso não encontrado", 404);

  const { data: jud } = await supabase
    .from("system_case_judicial_processos")
    .select("numero_processo, projuris_codigo_processo")
    .eq("case_id", caseId)
    .maybeSingle();

  let clienteNome: string | null = null;
  if (caso.client_id) {
    const { data: cli } = await supabase
      .from("system_clients")
      .select("full_name")
      .eq("id", caso.client_id)
      .maybeSingle();
    clienteNome = cli?.full_name ?? null;
  }

  const chave = `inicial:${caseId}`;
  const { data: existente } = await supabase
    .from("system_distribution_movements")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("origem", "INICIAL_SHV")
    .eq("projuris_id", chave)
    .eq("decisao", "PENDENTE")
    .maybeSingle();
  if (existente) return { movementId: existente.id, jaExistia: true };

  const { data, error } = await supabase
    .from("system_distribution_movements")
    .insert({
      organization_id: ORG_ID,
      origem: "INICIAL_SHV",
      projuris_id: chave,
      projuris_processo_codigo:
        jud?.projuris_codigo_processo != null ? String(jud.projuris_codigo_processo) : null,
      numero_cnj: jud?.numero_processo ?? null,
      descricao: `Inicial — ${caso.case_code ?? "caso"}`,
      cliente_nome: clienteNome,
      data_referencia: ymd(new Date()),
      case_id: caseId,
      tema_id: caso.tema_id,
      decisao: "PENDENTE",
      criado_por: userId,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new AuthError(`Falha ao enviar inicial: ${error?.message ?? "?"}`, 500);
  void userId;
  return { movementId: data.id, jaExistia: false };
}

/**
 * Traz os andamentos do período, paginando de trás para frente no tempo.
 *
 * O endpoint não filtra por data (ignora o que não conhece no corpo), mas devolve
 * do mais recente para o mais antigo — então paginamos até passar do início da
 * janela. O teto de páginas existe para o caso de a ordem mudar do lado deles:
 * sem ele, uma mudança silenciosa viraria um loop de 360 mil registros.
 */
async function buscarAndamentosDoPeriodo(
  client: {
    projurisPostConsulta: <T>(
      path: string,
      body: unknown,
      query?: Record<string, string | number | undefined>,
    ) => Promise<T>;
  },
  dataInicial: string,
  dataFinal: string,
  maxPaginas = 15,
): Promise<Array<Record<string, unknown>>> {
  const porPagina = 200;
  const coletados: Array<Record<string, unknown>> = [];
  const dataDe = (a: Record<string, unknown>): string | null =>
    typeof a.dataAndamento === "number"
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(a.dataAndamento))
      : null;

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const r = await client.projurisPostConsulta<{
      andamentoWs?: Array<Record<string, unknown>>;
    }>("andamento/consulta-geral", {}, { pagina, "quan-registros": porPagina });
    const lote = r.andamentoWs ?? [];
    if (lote.length === 0) break;

    for (const a of lote) {
      const d = dataDe(a);
      if (d && d >= dataInicial && d <= dataFinal) coletados.push(a);
    }

    // Se a página inteira já é anterior à janela, o resto também será.
    const maisAntigo = lote.map(dataDe).filter(Boolean).sort()[0];
    if (maisAntigo && maisAntigo < dataInicial) break;
    if (lote.length < porPagina) break;
  }
  return coletados;
}

export async function listMovements(opts: {
  decisao?: MovementDecisao | "TODAS";
  data?: string | null;
  /** Esconde o que o ProJuris já marcou como arquivado (ver nota em syncMovements). */
  ocultarArquivadas?: boolean;
  /**
   * S1-03 — `false` devolve TODAS as linhas, sem agrupar as repetidas do mesmo
   * processo. Default: agrupado (é o que a fila da controladoria usa).
   */
  agrupado?: boolean;
}): Promise<Movement[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("system_distribution_movements")
    .select(
      "id, origem, projuris_id, projuris_processo_codigo, numero_cnj, descricao, cliente_nome, data_referencia, case_id, tema_id, decisao, task_type_id, decidido_em, situacao_projuris, client_id, projuris_sync_at, projuris_sync_error, grupo_processo_dia",
    )
    .eq("organization_id", ORG_ID)
    .order("data_referencia", { ascending: false })
    .limit(500);
  if (opts.decisao && opts.decisao !== "TODAS") q = q.eq("decisao", opts.decisao);
  if (opts.data) q = q.eq("data_referencia", opts.data);
  // Atenção ao NULL: `neq` vira `<> 'ARQUIVADA'`, que é NULL (não TRUE) para
  // linhas sem situação — e some com elas. As iniciais mandadas pela ficha
  // Judicial nascem justamente sem situação, então precisam do `is.null`.
  if (opts.ocultarArquivadas) q = q.or("situacao_projuris.is.null,situacao_projuris.neq.ARQUIVADA");
  const { data, error } = await q;
  if (error) throw new AuthError(`Falha ao listar movimentos: ${error.message}`, 500);

  // Cast: `supabase/types.ts` é gerado pelo CLI (que não roda nesta máquina) e
  // ainda não conhece `grupo_processo_dia`. A coluna existe desde a migration
  // 20260904000001; regerar os tipos remove o cast.
  const linhas = (data ?? []) as unknown as Movement[];

  // S1-03 (A1, Thiago 04/09) — "sistema lista apenas 1 (a primeira) e deixa as
  // outras em stand by". O agrupamento é por PROCESSO + DIA, e vale só para o que
  // ainda está PENDENTE: histórico e telas de auditoria continuam vendo tudo.
  if (opts.agrupado === false || (opts.decisao && opts.decisao !== "PENDENTE")) {
    return linhas;
  }

  const porGrupo = new Map<string, Movement[]>();
  for (const l of linhas) {
    const chave = l.grupo_processo_dia || `sem-grupo:${l.id}`;
    const arr = porGrupo.get(chave) ?? [];
    arr.push(l);
    porGrupo.set(chave, arr);
  }

  const agrupadas: Movement[] = [];
  for (const grupo of porGrupo.values()) {
    // "a primeira" = a mais antiga do dia, para a leitura seguir a ordem em que
    // chegaram. A consulta vem por data desc, então o fim do array é a primeira.
    const principal = grupo[grupo.length - 1];
    agrupadas.push({ ...principal, repetidas: grupo.length });
  }
  // Preserva a ordem da consulta (data desc) usando a posição da principal.
  agrupadas.sort((a, b) => linhas.indexOf(a as never) - linhas.indexOf(b as never));
  return agrupadas;
}

/**
 * S1-03 — as outras intimações do mesmo grupo (as que ficaram "em stand by").
 * Usada para expandir a linha na tela e para aplicar a decisão ao grupo.
 */
export async function listMovementsDoGrupo(movementId: string): Promise<Movement[]> {
  const supabase = getSupabaseAdmin();
  const { data: base } = await supabase
    .from("system_distribution_movements")
    .select("grupo_processo_dia" as never)
    .eq("id", movementId)
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  const chave = (base as { grupo_processo_dia?: string | null } | null)?.grupo_processo_dia;
  if (!chave) return [];

  const { data } = await supabase
    .from("system_distribution_movements")
    .select(
      "id, origem, projuris_id, projuris_processo_codigo, numero_cnj, descricao, cliente_nome, data_referencia, case_id, tema_id, decisao, task_type_id, decidido_em, situacao_projuris, client_id, projuris_sync_at, projuris_sync_error, grupo_processo_dia",
    )
    .eq("organization_id", ORG_ID)
    .eq("grupo_processo_dia" as never, chave as never)
    .order("data_referencia", { ascending: true });
  return (data ?? []) as unknown as Movement[];
}

/**
 * Registra a decisão humana de um movimento. Quando é DISTRIBUIR, já cria a
 * linha da TELA 2 com as variáveis pré-preenchidas a partir do tipo de tarefa,
 * do caso e das exceções de responsável por tema.
 */
export async function decideMovement(
  movementId: string,
  decisao: MovementDecisao,
  taskTypeId: string | null,
  userId: string,
): Promise<{
  stagingId: string | null;
  projuris?: { enviado: boolean; motivo?: string };
  /** S1-03 — quantas repetidas do mesmo processo foram arquivadas junto. */
  repetidasArquivadas?: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data: mov } = await supabase
    .from("system_distribution_movements")
    .select("id, case_id, tema_id, numero_cnj, cliente_nome")
    .eq("id", movementId)
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  if (!mov) throw new AuthError("Movimento não encontrado", 404);

  if (decisao === "DISTRIBUIR" && !taskTypeId)
    throw new AuthError("Escolha o tipo de tarefa a distribuir", 400);

  const { error } = await supabase
    .from("system_distribution_movements")
    .update({
      decisao,
      task_type_id: decisao === "DISTRIBUIR" ? taskTypeId : null,
      decidido_por: userId,
      decidido_em: new Date().toISOString(),
    } as never)
    .eq("id", movementId)
    .eq("organization_id", ORG_ID);
  if (error) throw new AuthError(`Falha ao registrar decisão: ${error.message}`, 500);

  // Arquivar/marcar lido valem NOS DOIS sistemas (reunião 19/08: "Isso no
  // ProJuris"). Best-effort: se a trava estiver desligada ou a chamada falhar,
  // a decisão local continua valendo.
  const projuris = await refletirDecisaoNoProjuris(movementId, decisao);

  // S1-03 (A1, Thiago 04/09) — a decisão vale para o GRUPO (mesmo processo, mesmo
  // dia). Passos 5 e 6 do fluxo que ele descreveu:
  //
  //   "No projuris, arquiva tanto a intimação distribuida como as não
  //    visualizadas por repetição (movimento normal que todas as intimações devem
  //    ter). No SHV, mantém vinculada a intimação que gerou a tarefa (para o
  //    histórico), e as outras ficam com o status 'arquivado por repetição', que
  //    é diferente só do status 'arquivado'."
  //
  // Vale para QUALQUER decisão: arquivar direto ou distribuir. A tarefa fica
  // ligada só à intimação visualizada — "na prática não tem diferença de qual
  // intimação veio", porque o vínculo real é com o processo.
  const irmas = (await listMovementsDoGrupo(movementId)).filter(
    (m) => m.id !== movementId && m.decisao === "PENDENTE",
  );
  let repetidasArquivadas = 0;
  if (irmas.length > 0) {
    const { error: errIrmas } = await supabase
      .from("system_distribution_movements")
      .update({
        decisao: "ARQUIVADO_REPETICAO",
        decidido_por: userId,
        decidido_em: new Date().toISOString(),
      } as never)
      .in(
        "id",
        irmas.map((m) => m.id),
      );
    if (!errIrmas) repetidasArquivadas = irmas.length;

    // No ProJuris cada uma é arquivada individualmente — é o movimento que toda
    // intimação precisa ter lá. Best-effort, uma a uma: a falha de uma não
    // derruba a decisão nem as outras.
    for (const irma of irmas) {
      try {
        await refletirDecisaoNoProjuris(irma.id, "ARQUIVADO");
      } catch (err) {
        console.error(`decideMovement: falha ao arquivar repetida ${irma.id} no ProJuris:`, err);
      }
    }
  }

  if (decisao !== "DISTRIBUIR") {
    // Mudou de ideia: se já havia uma linha aberta na tela 2, ela sai.
    await supabase
      .from("system_distribution_staging")
      .update({ status: "CANCELADA" } as never)
      .eq("movement_id", movementId)
      .eq("status", "ABERTA");
    return { stagingId: null, projuris, repetidasArquivadas };
  }

  // Decidir "distribuir" duas vezes (ou trocar o tipo depois de decidir) NÃO
  // pode gerar duas linhas na fila — o motor distribuiria a mesma tarefa para
  // dois executores, com pontos em dobro. Se já existe uma aberta para este
  // movimento, ela é ATUALIZADA em vez de duplicada.
  const { data: jaAberta } = await supabase
    .from("system_distribution_staging")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("movement_id", movementId)
    .eq("status", "ABERTA")
    .maybeSingle();

  if (jaAberta) {
    await atualizarTipoDoStaging(jaAberta.id, taskTypeId!, mov.tema_id);
    return { stagingId: jaAberta.id, projuris, repetidasArquivadas };
  }

  const staging = await criarStagingDoMovimento(movementId, taskTypeId!, mov, userId);
  return { stagingId: staging, projuris, repetidasArquivadas };
}

/**
 * Troca o tipo de uma linha que JÁ está na fila, recalculando o que depende dele
 * (pontos, prazos, complexo/urgente e o executor exclusivo).
 *
 * Existe por causa do achado do QA: decidir "distribuir" de novo — ou mudar de
 * ideia sobre o tipo — criava uma SEGUNDA linha, e o motor distribuía a mesma
 * tarefa duas vezes, para dois executores, com pontos em dobro.
 */
async function atualizarTipoDoStaging(
  stagingId: string,
  taskTypeId: string,
  temaId: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: tipo } = await supabase
    .from("system_task_type_mapping")
    .select(
      "points, complexity_level, temporal_level, prazo_previsto_dias, prazo_fatal_dias, exclusive_executor_id",
    )
    .eq("id", taskTypeId)
    .maybeSingle();
  if (!tipo) throw new AuthError("Tipo de tarefa não encontrado", 404);

  // Mesma precedência do caminho de criação (regra única em resolverExclusivo):
  // exceção por tema > exclusivo geral > responsável do caso.
  const { data: linhaAtual } = await supabase
    .from("system_distribution_staging")
    .select("case_id")
    .eq("id", stagingId)
    .maybeSingle();
  const exclusivo = await resolverExclusivo(
    supabase,
    taskTypeId,
    temaId,
    tipo.exclusive_executor_id ?? null,
    (linhaAtual as { case_id?: string | null } | null)?.case_id ?? null,
  );

  const hoje = ymd(new Date());
  const { error } = await supabase
    .from("system_distribution_staging")
    .update({
      task_type_id: taskTypeId,
      pontos: tipo.points ?? 1,
      complexo: (tipo.complexity_level ?? 0) > 0,
      urgente: (tipo.temporal_level ?? 0) > 0,
      exclusive_executor_id: exclusivo,
      data_prevista:
        tipo.prazo_previsto_dias != null ? addDaysIso(hoje, tipo.prazo_previsto_dias) : null,
      data_fatal: tipo.prazo_fatal_dias != null ? addDaysIso(hoje, tipo.prazo_fatal_dias) : null,
    } as never)
    .eq("id", stagingId)
    .eq("organization_id", ORG_ID);
  if (error) throw new AuthError(`Falha ao trocar o tipo: ${error.message}`, 500);
}

/**
 * Quem é o dono desta tarefa, por ordem de precedência (T2 — reunião 2026-08-26):
 *
 *   1. exceção do tipo NESTE tema  (system_task_type_theme_exclusives)
 *   2. exclusivo geral do tipo     (system_task_type_mapping.exclusive_executor_id)
 *   3. RESPONSÁVEL DO CASO         (system_case_responsaveis) — novidade
 *   4. nada → o motor distribui por pontos
 *
 * O degrau 3 é o pedido do Thiago: "colocar um registro lá [no caso], uma opção
 * de que esse caso tem um vínculo com X usuário, e aí o sistema na hora de rodar
 * o motor vai puxar (…) esse campo lá dos casos".
 *
 * Decisão do owner: vale SÓ quando o caso tem exatamente UM responsável. Com dois
 * ou mais, o sistema não escolhe no chute — cai na distribuição normal.
 *
 * O resultado vira o `exclusive_executor_id` da linha da tela 2, que fica VISÍVEL
 * e EDITÁVEL antes de rodar o motor ("processo automatizado, não automático").
 */
async function resolverExclusivo(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  taskTypeId: string,
  temaId: string | null,
  exclusivoDoTipo: string | null,
  caseId: string | null,
): Promise<string | null> {
  // 1) Exceção por tema tem precedência sobre o exclusivo geral (doc 21.08).
  if (temaId) {
    const { data: exc } = await supabase
      .from("system_task_type_theme_exclusives")
      .select("executor_id")
      .eq("task_type_id", taskTypeId)
      .eq("tema_id", temaId)
      .maybeSingle();
    if (exc?.executor_id) return exc.executor_id as string;
  }

  // 2) Exclusivo geral do tipo.
  if (exclusivoDoTipo) return exclusivoDoTipo;

  // 3) Responsável do caso — só quando é UM só.
  if (caseId) {
    const { data: resps } = await supabase
      .from("system_case_responsaveis_active")
      .select("user_id")
      .eq("case_id", caseId);
    const ids = [...new Set((resps ?? []).map((r) => (r as { user_id: string }).user_id))];
    if (ids.length === 1) return ids[0];
  }

  return null;
}

/** Monta a linha da tela 2 com tudo que o sistema já sabe (editável depois). */
async function criarStagingDoMovimento(
  movementId: string,
  taskTypeId: string,
  mov: {
    case_id: string | null;
    tema_id: string | null;
    numero_cnj: string | null;
    cliente_nome: string | null;
  },
  userId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data: tipo } = await supabase
    .from("system_task_type_mapping")
    .select(
      "id, points, complexity_level, temporal_level, prazo_previsto_dias, prazo_fatal_dias, exclusive_executor_id",
    )
    .eq("id", taskTypeId)
    .maybeSingle();
  if (!tipo) throw new AuthError("Tipo de tarefa não encontrado", 404);

  const exclusivo = await resolverExclusivo(
    supabase,
    taskTypeId,
    mov.tema_id,
    tipo.exclusive_executor_id ?? null,
    mov.case_id,
  );

  const hoje = ymd(new Date());
  const { data, error } = await supabase
    .from("system_distribution_staging")
    .insert({
      organization_id: ORG_ID,
      movement_id: movementId,
      case_id: mov.case_id,
      tema_id: mov.tema_id,
      task_type_id: taskTypeId,
      numero_cnj: mov.numero_cnj,
      cliente_nome: mov.cliente_nome,
      // Sugestões do sistema — a pessoa confirma ou troca na tela 2.
      complexo: (tipo.complexity_level ?? 0) > 0,
      urgente: (tipo.temporal_level ?? 0) > 0,
      coletivo: false,
      exclusive_executor_id: exclusivo,
      data_prevista:
        tipo.prazo_previsto_dias != null ? addDaysIso(hoje, tipo.prazo_previsto_dias) : null,
      data_fatal: tipo.prazo_fatal_dias != null ? addDaysIso(hoje, tipo.prazo_fatal_dias) : null,
      pontos: tipo.points ?? 1,
      overrides: {} as never,
      status: "ABERTA",
      // Quem decidiu distribuir e preparou a linha (o motor grava
      // `distribuido_por` só na hora de distribuir).
      preparado_por: userId,
      created_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (error || !data)
    throw new AuthError(`Falha ao preparar a tarefa: ${error?.message ?? "?"}`, 500);
  void userId;
  return data.id;
}

// ---------------------------------------------------------------------------
// TELA 2 — revisão humana das variáveis
// ---------------------------------------------------------------------------

export async function listStaging(status = "ABERTA"): Promise<StagingItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("system_distribution_staging")
    .select(
      "id, movement_id, case_id, tema_id, task_type_id, numero_cnj, cliente_nome, coletivo, complexo, urgente, exclusive_executor_id, data_prevista, data_fatal, pontos, status, created_at",
    )
    .eq("organization_id", ORG_ID)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new AuthError(`Falha ao listar tarefas a distribuir: ${error.message}`, 500);
  return (data ?? []) as StagingItem[];
}

export interface StagingPatch {
  coletivo?: boolean;
  complexo?: boolean;
  urgente?: boolean;
  exclusive_executor_id?: string | null;
  data_prevista?: string | null;
  data_fatal?: string | null;
  pontos?: number | null;
  task_type_id?: string | null;
}

/** Alteração manual da tela 2. Guarda em `overrides` o que a pessoa mexeu. */
export async function updateStagingItem(id: string, patch: StagingPatch): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: atual } = await supabase
    .from("system_distribution_staging")
    .select("overrides, status")
    .eq("id", id)
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  if (!atual) throw new AuthError("Tarefa não encontrada", 404);
  if (atual.status !== "ABERTA")
    throw new AuthError("Esta tarefa já foi distribuída — não dá para alterar", 409);

  const overrides = {
    ...((atual.overrides as Record<string, unknown> | null) ?? {}),
    ...patch,
  };

  const { error } = await supabase
    .from("system_distribution_staging")
    .update({ ...patch, overrides } as never)
    .eq("id", id)
    .eq("organization_id", ORG_ID);
  if (error) throw new AuthError(`Falha ao salvar alteração: ${error.message}`, 500);
}

export async function cancelStagingItem(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("system_distribution_staging")
    .update({ status: "CANCELADA" } as never)
    .eq("id", id)
    .eq("organization_id", ORG_ID)
    .eq("status", "ABERTA");
  if (error) throw new AuthError(`Falha ao cancelar: ${error.message}`, 500);
}

// ---------------------------------------------------------------------------
// HISTÓRICOS (páginas 3 e 4 do doc 21.08)
//
// São DOIS históricos distintos, e o doc é explícito sobre a diferença:
//   • ANDAMENTOS — o que chegou do ProJuris e o que a pessoa decidiu sobre ele.
//     "Andamento 1 - processo X - DATA - DISTRIBUIDO TAREFA X - Data análise",
//     com filtro pela data de referência do ProJuris.
//   • TAREFAS — o que o motor efetivamente distribuiu: "nº identificador tarefa,
//     processo, tipo, executor, situação, data prevista, data fatal, regra de
//     distribuição, pontos".
// ---------------------------------------------------------------------------

export interface HistoricoAndamento {
  id: string;
  origem: string;
  numero_cnj: string | null;
  cliente_nome: string | null;
  descricao: string | null;
  /** Data em que o ProJuris registrou o andamento/intimação. */
  data_referencia: string | null;
  decisao: string;
  task_type_id: string | null;
  /** Data em que a pessoa analisou. */
  decidido_em: string | null;
  decidido_por_nome: string | null;
  projuris_sync_at: string | null;
}

export async function listHistoricoAndamentos(opts: {
  de?: string | null;
  ate?: string | null;
  decisao?: string | null;
}): Promise<HistoricoAndamento[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("system_distribution_movements")
    .select(
      "id, origem, numero_cnj, cliente_nome, descricao, data_referencia, decisao, task_type_id, decidido_em, decidido_por, projuris_sync_at",
    )
    .eq("organization_id", ORG_ID)
    .neq("decisao", "PENDENTE")
    .order("decidido_em", { ascending: false })
    .limit(500);
  if (opts.de) q = q.gte("data_referencia", opts.de);
  if (opts.ate) q = q.lte("data_referencia", opts.ate);
  if (opts.decisao) q = q.eq("decisao", opts.decisao);

  const { data, error } = await q;
  if (error) throw new AuthError(`Falha ao listar histórico: ${error.message}`, 500);
  const linhas = data ?? [];

  const nomes = await nomesDeUsuarios(linhas.map((l) => l.decidido_por));
  return linhas.map((l) => ({
    id: l.id,
    origem: l.origem,
    numero_cnj: l.numero_cnj,
    cliente_nome: l.cliente_nome,
    descricao: l.descricao,
    data_referencia: l.data_referencia,
    decisao: l.decisao,
    task_type_id: l.task_type_id,
    decidido_em: l.decidido_em,
    decidido_por_nome: l.decidido_por ? (nomes.get(l.decidido_por) ?? null) : null,
    projuris_sync_at: l.projuris_sync_at,
  }));
}

export interface HistoricoTarefa {
  id: string;
  numero_cnj: string | null;
  cliente_nome: string | null;
  task_type_id: string | null;
  executor_nome: string | null;
  situacao: string;
  data_prevista: string | null;
  data_fatal: string | null;
  /** Fluxo escolhido pelo motor (GENERAL, ABSOLUTE…) = "regra de distribuição". */
  regra: string | null;
  pontos: number | null;
  /** Dia em que o motor colocou na agenda. */
  data_distribuicao: string | null;
}

export async function listHistoricoTarefas(opts: {
  de?: string | null;
  ate?: string | null;
}): Promise<HistoricoTarefa[]> {
  const supabase = getSupabaseAdmin();

  let q = supabase
    .from("system_distribution_staging")
    .select(
      "id, numero_cnj, cliente_nome, task_type_id, data_prevista, data_fatal, pontos, status, distribuido_em",
    )
    .eq("organization_id", ORG_ID)
    .eq("status", "DISTRIBUIDA")
    .order("distribuido_em", { ascending: false })
    .limit(500);
  if (opts.de) q = q.gte("distribuido_em", `${opts.de}T00:00:00`);
  if (opts.ate) q = q.lte("distribuido_em", `${opts.ate}T23:59:59`);

  const { data, error } = await q;
  if (error) throw new AuthError(`Falha ao listar tarefas: ${error.message}`, 500);
  const itens = data ?? [];
  if (itens.length === 0) return [];

  // O resultado do motor (executor, regra, pontos finais) vive em results — a
  // ligação é results.task_id = staging.id (ver distribuirStaging).
  const { data: results } = await supabase
    .from("system_distribution_results")
    .select("task_id, executor_id, flow, final_points, final_date")
    .in(
      "task_id",
      itens.map((i) => i.id),
    );
  const porTask = new Map((results ?? []).map((r) => [r.task_id, r]));
  const nomes = await nomesDeUsuarios((results ?? []).map((r) => r.executor_id));

  return itens.map((i) => {
    const r = porTask.get(i.id);
    return {
      id: i.id,
      numero_cnj: i.numero_cnj,
      cliente_nome: i.cliente_nome,
      task_type_id: i.task_type_id,
      executor_nome: r?.executor_id ? (nomes.get(r.executor_id) ?? null) : null,
      situacao: i.status,
      data_prevista: i.data_prevista,
      data_fatal: i.data_fatal,
      regra: r?.flow ?? null,
      pontos: r?.final_points ?? i.pontos,
      data_distribuicao: r?.final_date ?? i.distribuido_em?.slice(0, 10) ?? null,
    };
  });
}

/** id → nome de exibição, para não mostrar UUID na tela. */
async function nomesDeUsuarios(ids: Array<string | null>): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((v): v is string => !!v))];
  if (unicos.length === 0) return new Map();
  const { data } = await getSupabaseAdmin()
    .from("system_users")
    .select("id, full_name, email")
    .in("id", unicos);
  return new Map((data ?? []).map((u) => [u.id, u.full_name || u.email]));
}

// ---------------------------------------------------------------------------
// TELA 3 — o motor roda (só agora)
// ---------------------------------------------------------------------------

export interface DistribuirResumo {
  enviadas: number;
  distribuidas: number;
  bloqueadas: number;
  /** Quantas viraram tarefa no ProJuris. Menor que `distribuidas` = fila de reenvio. */
  espelhadas: number;
  /** Primeiros motivos de não ter espelhado, para a tela mostrar sem virar muro de texto. */
  falhasEspelho: string[];
  porExecutor: Array<{ executor_id: string; tarefas: number; pontos: number }>;
}

/**
 * Roda o motor SOBRE AS LINHAS APROVADAS da tela 2 e grava em
 * system_distribution_results (o mesmo destino do batch automático).
 *
 * Diferenças em relação ao `runSync`:
 *   • a entrada vem do staging (decisão humana), não do ProJuris;
 *   • NÃO apaga os resultados do dia — este lote é somado ao que já existe;
 *   • a média diária vem da configuração MANUAL (doc 21.08), não dos 90 dias.
 */
export async function distribuirStaging(
  ids: string[],
  userId: string,
  distributionDate?: string,
): Promise<DistribuirResumo> {
  const supabase = getSupabaseAdmin();
  if (ids.length === 0) throw new AuthError("Nenhuma tarefa selecionada", 400);

  const dataRef = distributionDate ?? ymd(new Date());

  const { data: itens, error: errItens } = await supabase
    .from("system_distribution_staging")
    .select("*")
    .eq("organization_id", ORG_ID)
    .eq("status", "ABERTA")
    .in("id", ids);
  if (errItens) throw new AuthError(`Falha ao ler tarefas: ${errItens.message}`, 500);
  if (!itens || itens.length === 0) throw new AuthError("Nenhuma tarefa aberta nessa seleção", 404);

  // --- Config (modo + média MANUAL de pontos/dia) ---
  const { data: cfg } = await supabase
    .from("system_distribution_config")
    .select("mode, pontos_dia_controle, pontos_dia_producao")
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  const mode = (cfg?.mode ?? "HIGH_PRODUCTION") as "HIGH_PRODUCTION" | "HIGH_CONTROL";
  const mediaDiaria =
    mode === "HIGH_CONTROL"
      ? Number(cfg?.pontos_dia_controle ?? 12)
      : Number(cfg?.pontos_dia_producao ?? 15);

  // --- Executores e calendário ---
  const { executors, calendar } = await carregarExecutoresECalendario(dataRef);

  // S1-04 — responsável direcionado do CASO (nível 1 da precedência do motor).
  const direcionados = await carregarResponsaveisDirecionados(
    supabase,
    new Set(executors.map((e) => e.executor_id)),
  );

  // --- Temas (multiplicador) e tipos, para montar as Task[] do motor ---
  const temaIds = [...new Set(itens.map((i) => i.tema_id).filter(Boolean))] as string[];
  const multiplicadorPorTema = new Map<string, { motor: string; mult: number; temporal: number }>();
  if (temaIds.length > 0) {
    const { data: temas } = await supabase
      .from("system_temas")
      .select("id, slug")
      .in("id", temaIds);
    const slugPorId = new Map((temas ?? []).map((t) => [t.id, t.slug as string]));
    const { data: mapTemas } = await supabase
      .from("system_theme_mapping")
      .select("motor_theme_id, multiplier, temporal_level")
      .eq("organization_id", ORG_ID)
      .eq("active", true);
    const porMotorId = new Map((mapTemas ?? []).map((m) => [m.motor_theme_id, m]));
    for (const [id, slug] of slugPorId) {
      const m = porMotorId.get(slug);
      multiplicadorPorTema.set(id, {
        motor: m?.motor_theme_id ?? slug ?? "SEM_TEMA",
        mult: Number(m?.multiplier ?? 1),
        temporal: Number(m?.temporal_level ?? 0),
      });
    }
  }

  const tasks: Task[] = [];
  const processes: Process[] = [];
  let ordem = 0;
  for (const it of itens) {
    const tema = it.tema_id ? multiplicadorPorTema.get(it.tema_id) : undefined;
    const temaMotorId = tema?.motor ?? "SEM_TEMA";
    // Cada linha do staging vira um "processo" próprio: a decisão foi tomada
    // caso a caso, e é o que o motor precisa para pontuar/priorizar.
    processes.push({
      process_id: it.id,
      theme_id: temaMotorId,
      collective: it.coletivo,
      complexity_level: (it.complexo ? 2 : 0) as 0 | 1 | 2,
      temporal_level: (it.urgente ? 2 : 0) as 0 | 1 | 2,
      // S1-04 — era `null` fixo. Aqui a linha da fila já traz o caso, então o
      // vínculo é direto (no sync-core o caminho é pelo código do ProJuris).
      directed_executor_id: it.case_id ? (direcionados.porCaso.get(it.case_id) ?? null) : null,
    });
    tasks.push({
      task_id: it.id,
      process_id: it.id,
      task_type_id: it.task_type_id ?? "SEM_TIPO",
      theme_id: temaMotorId,
      task_type_points: Number(it.pontos ?? 1) > 0 ? Number(it.pontos ?? 1) : 1,
      theme_multiplier: tema?.mult ?? 1,
      task_type_complexity_level: (it.complexo ? 2 : 0) as 0 | 1 | 2,
      task_type_temporal_level: (it.urgente ? 2 : 0) as 0 | 1 | 2,
      task_override_complexity_level: 0,
      task_override_temporal_level: 0,
      theme_complexity_level: 0,
      theme_temporal_level: (tema?.temporal ?? 0) as 0 | 1 | 2,
      theme_exclusive_executor_id: null,
      // A revisão da tela 2 é a palavra final sobre o exclusivo.
      task_type_exclusive_executor_id: it.exclusive_executor_id ?? null,
      fatal_date: it.data_fatal ?? "9999-12-31",
      internal_limit_date: it.data_prevista ?? it.data_fatal ?? "9999-12-31",
      input_order: ++ordem,
    });
  }

  const queueState: QueueState = {
    general_balances: {},
    complex_balances: {},
    rotating_order: executors.map((e) => e.executor_id),
  };
  const preferenceHistory: PreferenceHistory[] = [];

  const output = distributeBatch(
    buildBatchInput(
      crypto.randomUUID(),
      dataRef,
      mode,
      mediaDiaria,
      tasks,
      processes,
      executors,
      calendar,
      preferenceHistory,
      queueState,
    ),
  );

  const distribuidas = output.task_results.filter((r) => !r.blocked && r.executor_id);
  const bloqueadas = output.task_results.length - distribuidas.length;

  const porCliente = new Map(itens.map((i) => [i.id, i]));
  const rows = distribuidas.map((r) => {
    const it = porCliente.get(r.task_id);
    return {
      organization_id: ORG_ID,
      task_id: r.task_id,
      process_id: r.process_id,
      distribution_date: r.distribution_date,
      final_points: r.final_points,
      flow: r.flow,
      base_date: r.base_date,
      applicable_limit: r.applicable_limit,
      preferred_date: r.preferred_date,
      final_date: r.final_date,
      executor_id: r.executor_id,
      preference_applied: r.preference_applied,
      alerts: r.alerts,
      // `task_id` aqui é o UUID do staging, NÃO o codigoTarefa do ProJuris —
      // então esta linha não pode entrar na fila de write-back de responsável
      // (mandaria um UUID onde o ProJuris espera um código).
      writeback_pending: false,
      // Marca de origem: o batch automático limpa só o que ele mesmo criou.
      origem: "staging",
      blocked: false,
      raw_data: {
        origem: "staging",
        numero_processo: it?.numero_cnj ?? null,
        nome_processo: it?.cliente_nome ?? null,
        staging_id: it?.id ?? null,
      },
    };
  });

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase
      .from("system_distribution_results")
      .insert(rows.slice(i, i + 100) as never);
    if (error) throw new AuthError(`Falha ao gravar distribuição: ${error.message}`, 500);
  }

  const distribuidasIds = distribuidas.map((r) => r.task_id);
  if (distribuidasIds.length > 0) {
    await supabase
      .from("system_distribution_staging")
      .update({
        status: "DISTRIBUIDA",
        distribuido_em: new Date().toISOString(),
        distribuido_por: userId,
      } as never)
      .in("id", distribuidasIds);
  }

  // ---- espelha no ProJuris ------------------------------------------------
  //
  // A decisão da controladoria só serve para quem executa se aparecer na fila
  // DELE — e quem executa trabalha no ProJuris, não aqui. Por isso, logo depois
  // de gravar a distribuição, cada linha vira uma tarefa lá.
  //
  // BEST-EFFORT de propósito: a distribuição no SHV já está gravada e não é
  // desfeita se o ProJuris recusar. O que não espelhou fica com
  // `projuris_codigo_tarefa` nulo — é a fila de reenvio, e o índice
  // idx_dist_staging_sem_espelho existe justamente para encontrá-la.
  let espelhadas = 0;
  const falhasEspelho: string[] = [];
  for (const id of distribuidasIds) {
    try {
      const r = await criarTarefaNoProjuris(id);
      if (r.codigo) espelhadas += 1;
      else if (r.motivo && r.enviado) falhasEspelho.push(r.motivo);
    } catch (err) {
      falhasEspelho.push(err instanceof Error ? err.message : String(err));
    }
  }

  const agregado = new Map<string, { tarefas: number; pontos: number }>();
  for (const r of distribuidas) {
    const cur = agregado.get(r.executor_id) ?? { tarefas: 0, pontos: 0 };
    cur.tarefas += 1;
    cur.pontos += r.final_points;
    agregado.set(r.executor_id, cur);
  }

  return {
    enviadas: itens.length,
    distribuidas: distribuidas.length,
    bloqueadas,
    espelhadas,
    falhasEspelho: falhasEspelho.slice(0, 5),
    porExecutor: [...agregado].map(([executor_id, v]) => ({ executor_id, ...v })),
  };
}

/**
 * Pool de executores + calendário operacional. Mesmas regras do `runSync`:
 *   • pool  = peticionante && ACTIVE && mapeado (o exclusivo precisa estar no
 *     pool mesmo sem participar da fila geral);
 *   • fila geral = só quem tem participa_distribuicao_padrao (senão peso 0);
 *   • calendário = seg-sex menos bloqueios (geral desliga o dia, individual
 *     bloqueia a pessoa), janela de 60 dias.
 */
async function carregarExecutoresECalendario(
  distributionDate: string,
): Promise<{ executors: Executor[]; calendar: CalendarDay[] }> {
  const supabase = getSupabaseAdmin();

  const [exRes, usersRes, calRes] = await Promise.all([
    supabase
      .from("system_projuris_executor_mapping")
      .select(
        "executor_id, active, weight, eligible_complex, authorized_task_types, authorized_themes",
      )
      .eq("organization_id", ORG_ID)
      .eq("active", true),
    supabase.from("system_users").select("id, status, peticionante, participa_distribuicao_padrao"),
    supabase
      .from("system_distribution_calendar")
      .select("date, block_type, executor_id")
      .eq("organization_id", ORG_ID)
      .gte("date", distributionDate)
      .lte("date", addDaysIso(distributionDate, 60)),
  ]);

  const execById = new Map((exRes.data ?? []).map((m) => [m.executor_id, m]));
  const executors: Executor[] = (usersRes.data ?? [])
    .filter((u) => execById.has(u.id) && u.status === "ACTIVE" && u.peticionante === true)
    .map((u) => {
      const m = execById.get(u.id);
      const naFilaGeral = u.participa_distribuicao_padrao === true;
      return {
        executor_id: u.id,
        active: true,
        general_weight: naFilaGeral ? (m?.weight ?? 100) : 0,
        complex_eligible: m?.eligible_complex ?? false,
        authorized_task_types: m?.authorized_task_types ?? [],
        authorized_themes: m?.authorized_themes ?? [],
      };
    });

  if (executors.length === 0)
    throw new AuthError("Nenhum executor mapeado/ativo · impossível distribuir.", 422);

  const bloqueiosGerais = new Set<string>();
  const bloqueiosIndividuais = new Map<string, string[]>();
  for (const c of calRes.data ?? []) {
    if (c.block_type === "general") bloqueiosGerais.add(c.date);
    else if (c.block_type === "individual" && c.executor_id) {
      const arr = bloqueiosIndividuais.get(c.date) ?? [];
      arr.push(c.executor_id);
      bloqueiosIndividuais.set(c.date, arr);
    }
  }

  const calendar: CalendarDay[] = [];
  let cur = distributionDate;
  const fim = addDaysIso(distributionDate, 60);
  while (cur <= fim) {
    const [y, m, d] = cur.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    calendar.push({
      date: cur,
      globally_operational: dow >= 1 && dow <= 5 && !bloqueiosGerais.has(cur),
      initial_team_points: 0,
      blocked_executor_ids: bloqueiosIndividuais.get(cur) ?? [],
    });
    cur = addDaysIso(cur, 1);
  }

  return { executors, calendar };
}
