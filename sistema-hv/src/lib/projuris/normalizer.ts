// Normalizador (server-only) da ENTRADA do motor de distribuição (story A9).
//
// A "entrada" NÃO é a intimação sozinha. A intimação bruta traz PROCESSO +
// RESPONSÁVEL + datas + texto, mas NÃO traz assunto/tema, tipo-de-tarefa nem
// prazo. Esses dados vêm de dois GETs adicionais (descobertos empiricamente
// 2026-08-05):
//
//   • TAREFA(s) do processo → tipo-de-tarefa + prazos:
//     GET /adv-service/processo/{codigoProcesso}/tarefa/consulta-multi-modulo
//       → { totalRegistros, tarefaConsultaWs: [ TarefaConsultaWs ] }
//     Cada tarefa: codigoTarefaTipo (código ProJuris do tipo), nomeTarefaTipo,
//     dataConclusaoPrevista (epoch ms = prazo previsto), dataLimite (epoch ms =
//     prazo fatal), marcadores, usuarioResponsaveis, situacao/flagSituacaoConcluida.
//     (obs: esse endpoint devolve datas absolutas, não "dias" — derivamos os dias
//     em relação à data de disponibilização da intimação quando possível.)
//
//   • PROCESSO → candidatos a TEMA (assunto/marcadores/campos personalizados):
//     GET /adv-service/processo/{codigoProcesso}
//       → { assunto, assuntoCnj, marcadorWs[], campoDinamicoDadoWs[], area,
//           classeCnj, fase, ... }
//     O TEMA SHV (ex.: "INDENIZAÇÃO PMMB", "DEFESA MÉDICA") NÃO está em
//     /processo/assunto (que só traz os assuntos CNJ de topo). Ele mora em UM
//     destes campos do processo — assunto, um marcador, ou um campo personalizado.
//     A resolução final é CONFIGURÁVEL via resolveTema() (ver TODO lá dentro);
//     por ora expomos os 3 baldes crus p/ o Thiago inspecionar e confirmar.
//
// REGRA CRÍTICA: SÓ LEITURA (GET/consulta). Nada é gravado no ProJuris.
//
// SEGURANÇA: server-only. Importa o client (que lê segredos de env/config). NUNCA
// importar no bundle do browser.

import type { ProjurisClient } from "./client.js";

// ----------------------------------------------------------------------------
// Tipos de saída
// ----------------------------------------------------------------------------

export interface CampoPersonalizado {
  codigoCampoDinamico: number | null;
  nome: string | null;
  tipo: string | null;
  /** Valor "achatado" (texto/número/data/boolean/itens-de-lista), o que houver. */
  valor: string | number | boolean | null;
}

export interface TemaCandidatos {
  /** `assunto` do processo (string livre; candidato mais provável ao TEMA SHV). */
  assunto: string | null;
  /** `assuntoCnj` (assunto CNJ do processo, se houver). */
  assuntoCnj: string | null;
  /** `marcadorWs[]` do processo (nomes dos marcadores). */
  marcadores: string[];
  /** `campoDinamicoDadoWs[]` do processo (campos personalizados, achatados). */
  camposPersonalizados: CampoPersonalizado[];
}

export interface NormalizedIntimacao {
  codigoIntimacao: number | null;
  numeroProcesso: string | null;
  codigoProcesso: number | null;
  /** Código ProJuris do tipo de tarefa (da tarefa associada). null se sem tarefa. */
  tipo_tarefa_codigo: number | null;
  /** Nome do tipo de tarefa (da tarefa associada). */
  tipo_tarefa_nome: string | null;
  /** Candidatos a TEMA extraídos do PROCESSO (para resolveTema()). */
  tema_candidatos: TemaCandidatos;
  /** Tema resolvido (por ora = assunto; ver resolveTema() TODO). */
  tema_resolvido: string | null;
  /** Prazo previsto em dias (derivado de dataConclusaoPrevista vs disponibilização); null se indeterminado. */
  prazo_previsto: number | null;
  /** Prazo fatal em dias (derivado de dataLimite vs disponibilização); null se indeterminado. */
  prazo_fatal: number | null;
  /** Datas absolutas (epoch ms) da tarefa, quando existirem. */
  prazo_previsto_data: number | null;
  prazo_fatal_data: number | null;
  /** Código do responsável (da intimação; usuariosResponsaveis[0]). */
  responsavel_cod: number | null;
  responsavel_nome: string | null;
  /** Data de disponibilização da intimação (epoch ms). */
  data_disponibilizacao: number | null;
  /** Quantas tarefas o processo tem (diagnóstico); e qual foi escolhida. */
  _tarefas_no_processo: number;
  /** Alertas não-fatais (ex.: sem tarefa, sem processo) — não quebram o batch. */
  alerts: string[];
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Achata um campoDinamicoDadoWs em { valor } legível. */
function flattenCampo(raw: Record<string, unknown>): CampoPersonalizado {
  const tipo = asStr(raw.campoDinamicoTipo);
  const texto = asStr(raw.valorCampoTexto);
  const numero = asNum(raw.valorCampoNumero);
  const data = asNum(raw.valorCampoData);
  // valorCampoBoolean vem SEMPRE (default false) mesmo em campos não-boolean;
  // só considera o boolean quando o TIPO do campo for booleano, senão vira
  // ruído (ex.: um TEXTO_CURTO vazio apareceria como `false`).
  const bool =
    tipo && /BOOLEAN|CHECK|SIM_NAO/i.test(tipo) && typeof raw.valorCampoBoolean === "boolean"
      ? raw.valorCampoBoolean
      : null;
  // itens de lista selecionados (LISTA_SELECAO_*): pega os rótulos, se houver.
  let itens: string | null = null;
  const sel = raw.itensSelecionadosLista ?? raw.campoDinamicoItemLabel;
  if (Array.isArray(sel) && sel.length) {
    itens =
      sel
        .map((it) =>
          typeof it === "string"
            ? it
            : (asStr((it as Record<string, unknown>)?.valor) ??
              asStr((it as Record<string, unknown>)?.label) ??
              asStr((it as Record<string, unknown>)?.descricao)),
        )
        .filter(Boolean)
        .join(", ") || null;
  }
  const valor: string | number | boolean | null =
    itens ?? texto ?? (numero !== null ? numero : data !== null ? data : bool);
  return {
    codigoCampoDinamico: asNum(raw.codigoCampoDinamico),
    nome: asStr(raw.nomeCampoDinamico),
    tipo,
    valor,
  };
}

/** Extrai nomes de marcadores de um marcadorWs[] (formato varia: string ou {valor}). */
function marcadorNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) =>
      typeof m === "string"
        ? m
        : (asStr((m as Record<string, unknown>)?.valor) ??
          asStr((m as Record<string, unknown>)?.nome) ??
          asStr((m as Record<string, unknown>)?.descricao)),
    )
    .filter((s): s is string => !!s);
}

const DAY_MS = 86_400_000;
function diffDays(alvo: number | null, base: number | null): number | null {
  if (alvo === null || base === null) return null;
  return Math.round((alvo - base) / DAY_MS);
}

// ----------------------------------------------------------------------------
// TEMA — resolução CONFIGURÁVEL
// ----------------------------------------------------------------------------

/**
 * Código do campo personalizado "TEMA" do processo, descoberto no smoke
 * (2026-08-05): `codigoCampoDinamico=10021`, nome "TEMA", tipo TEXTO_CURTO.
 * Nos processos amostrados esse campo veio VAZIO — quem está populado é o
 * `assunto` (com valores que casam com o SHV: "1% ESF", "1% COVID", "CÍVEIS",
 * "CONCESSÃO", etc.). Por isso a heurística prefere o campo "TEMA" quando ele
 * tem valor e cai p/ `assunto` quando não.
 *
 * TODO(A9/Thiago): CONFIRMAR a fonte canônica do TEMA SHV. Evidência do smoke:
 *   • `assunto` = onde o tema aparece HOJE (populado) → dirige o `multiplier`
 *     de system_theme_mapping (cujo projuris_tema_codigo hoje é NOME placeholder,
 *     ex.: "1% COVID"). Casaria por nome com o `assunto`.
 *   • campo personalizado "TEMA" (10021) = campo dedicado, porém VAZIO nos
 *     processos vistos — pode ser o destino "oficial" ainda não preenchido.
 *   Quando o Thiago confirmar, fixar aqui a leitura determinística.
 */
export const PROJURIS_CAMPO_TEMA_CODIGO = 10021;

export function resolveTema(cand: TemaCandidatos): string | null {
  // 1) campo personalizado "TEMA" (por código), se estiver preenchido.
  const campoTema = cand.camposPersonalizados.find(
    (c) => c.codigoCampoDinamico === PROJURIS_CAMPO_TEMA_CODIGO,
  );
  if (campoTema && (typeof campoTema.valor === "string" || typeof campoTema.valor === "number")) {
    const v = String(campoTema.valor).trim();
    if (v) return v;
  }
  // 2) qualquer campo personalizado cujo NOME sugira tema/assunto/frente.
  const hit = cand.camposPersonalizados.find(
    (c) =>
      /tema|assunto|frente/i.test(c.nome ?? "") &&
      (typeof c.valor === "string" || typeof c.valor === "number") &&
      String(c.valor).trim(),
  );
  if (hit) return String(hit.valor).trim();
  // 3) `assunto` do processo (populado hoje; casa com system_theme_mapping).
  if (cand.assunto) return cand.assunto;
  // 4) 1º marcador, se houver.
  if (cand.marcadores.length) return cand.marcadores[0];
  return null;
}

// ----------------------------------------------------------------------------
// TEMA — resolução para motor_theme_id via de-para normalizado (H4)
// ----------------------------------------------------------------------------

/**
 * Normaliza uma string de tema para casamento tolerante: remove acentos,
 * caixa e espaços extras (ex.: "INDENIZAÇÃO PMMB" === "indenizacao  pmmb").
 * Espelha `normalizeName` de scripts/reconcile-projuris-tipos.ts para manter
 * o mesmo critério de de-para em toda a base.
 */
export function normalizeTemaKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Linha do de-para de TEMA (subset de system_theme_mapping usado pelo motor). */
export interface ThemeMapRow {
  motor_theme_id: string;
  multiplier: number;
  temporal_level: number;
  exclusive_executor_id: string | null;
}

/** Resultado da resolução do TEMA → motor. */
export interface ResolvedTema {
  /** Linha do de-para casada. */
  theme: ThemeMapRow;
  /** String de tema que casou (candidato vencedor, valor cru). */
  tema_resolvido: string;
  /** De qual balde saiu o casamento (diagnóstico). */
  source: "campo_10021" | "campo_nome" | "assunto" | "marcador";
}

/**
 * Fonte configurável do tema. A ordem default segue o achado A9 (2026-08-05):
 * campo "TEMA" (10021) quando preenchido → `assunto` do processo → marcador.
 * Quando o Thiago confirmar a fonte canônica, basta reordenar esta constante
 * (ex.: fixar `assunto` primeiro), sem tocar na lógica de casamento.
 */
export type TemaSource = "campo_10021" | "campo_nome" | "assunto" | "marcador";
export const TEMA_SOURCE_ORDER_DEFAULT: readonly TemaSource[] = [
  "campo_10021",
  "campo_nome",
  "assunto",
  "marcador",
] as const;

/** Coleta os valores-candidato de um balde (podem ser vários no caso de marcador). */
function candidatosDoBalde(cand: TemaCandidatos, source: TemaSource): string[] {
  switch (source) {
    case "campo_10021": {
      const c = cand.camposPersonalizados.find(
        (x) => x.codigoCampoDinamico === PROJURIS_CAMPO_TEMA_CODIGO,
      );
      if (c && (typeof c.valor === "string" || typeof c.valor === "number")) {
        const v = String(c.valor).trim();
        return v ? [v] : [];
      }
      return [];
    }
    case "campo_nome": {
      const c = cand.camposPersonalizados.find(
        (x) =>
          /tema|assunto|frente/i.test(x.nome ?? "") &&
          (typeof x.valor === "string" || typeof x.valor === "number") &&
          String(x.valor).trim(),
      );
      return c ? [String(c.valor).trim()] : [];
    }
    case "assunto":
      return cand.assunto ? [cand.assunto] : [];
    case "marcador":
      return cand.marcadores.filter((m) => m && m.trim());
  }
}

/**
 * Resolve o TEMA SHV (`motor_theme_id` + multiplier/temporal/exclusive) a partir
 * dos candidatos do processo (assunto / campo 10021 / marcador), casando por
 * NOME normalizado (acento/caixa/espaço) contra o de-para de `system_theme_mapping`.
 *
 * Retorna `null` quando NENHUM candidato casa — o chamador (sync-core) trata o
 * fallback com alerta (`ALT-TEMA-001`), sem descartar silenciosamente.
 *
 * @param themeMap de-para NOME-normalizado → linha do motor (construído pelo
 *   chamador a partir de system_theme_mapping via `buildThemeMap`).
 * @param order ordem de fontes (default = achado A9). Configurável para virar
 *   p/ o campo dedicado sem retrabalho.
 */
export function resolveTemaId(
  cand: TemaCandidatos,
  themeMap: Map<string, ThemeMapRow>,
  order: readonly TemaSource[] = TEMA_SOURCE_ORDER_DEFAULT,
): ResolvedTema | null {
  for (const source of order) {
    for (const valor of candidatosDoBalde(cand, source)) {
      const th = themeMap.get(normalizeTemaKey(valor));
      if (th) return { theme: th, tema_resolvido: valor, source };
    }
  }
  return null;
}

/**
 * Constrói o mapa NOME-normalizado → linha do motor a partir das linhas cruas de
 * `system_theme_mapping` (chave = `projuris_tema_codigo`, hoje NOME placeholder).
 * Em colisão de chave normalizada, a 1ª linha vence (determinístico por ordem de
 * entrada) — o owner audita via diagnóstico se necessário.
 */
export function buildThemeMap(
  rows: Array<{
    projuris_tema_codigo: string;
    motor_theme_id: string;
    multiplier: number;
    temporal_level: number;
    exclusive_executor_id: string | null;
  }>,
): Map<string, ThemeMapRow> {
  const m = new Map<string, ThemeMapRow>();
  for (const r of rows) {
    const key = normalizeTemaKey(r.projuris_tema_codigo ?? "");
    if (!key || m.has(key)) continue;
    m.set(key, {
      motor_theme_id: r.motor_theme_id,
      multiplier: r.multiplier,
      temporal_level: r.temporal_level,
      exclusive_executor_id: r.exclusive_executor_id,
    });
  }
  return m;
}

// ----------------------------------------------------------------------------
// Buscas (LEITURA) no ProJuris
// ----------------------------------------------------------------------------

interface TarefaConsultaWs {
  codigoTarefa?: number;
  codigoTarefaTipo?: number;
  nomeTarefaTipo?: string;
  dataConclusaoPrevista?: number;
  dataLimite?: number;
  ativo?: boolean;
  flagSituacaoConcluida?: boolean;
  dataInclusao?: number;
  [k: string]: unknown;
}

/** GET tarefas do processo (multi-modulo). SÓ LEITURA. */
async function fetchTarefasDoProcesso(
  pj: ProjurisClient,
  codigoProcesso: number,
): Promise<TarefaConsultaWs[]> {
  const r = await pj.projurisGet<{ tarefaConsultaWs?: TarefaConsultaWs[] }>(
    `processo/${codigoProcesso}/tarefa/consulta-multi-modulo`,
  );
  return r?.tarefaConsultaWs ?? [];
}

/** GET detalhe do processo (assunto/marcadores/campos). SÓ LEITURA. */
async function fetchProcesso(
  pj: ProjurisClient,
  codigoProcesso: number,
): Promise<Record<string, unknown>> {
  return pj.projurisGet<Record<string, unknown>>(`processo/${codigoProcesso}`);
}

/**
 * Escolhe a tarefa "mais relevante" de um processo para pontuar a intimação.
 * Heurística: prefere a tarefa ATIVA e NÃO concluída mais recente (por
 * dataInclusao); se todas concluídas, pega a mais recente. Retorna null se vazio.
 */
function pickTarefa(tarefas: TarefaConsultaWs[]): TarefaConsultaWs | null {
  if (!tarefas.length) return null;
  const abertas = tarefas.filter((t) => t.ativo !== false && t.flagSituacaoConcluida !== true);
  const pool = abertas.length ? abertas : tarefas;
  return pool.reduce((best, t) => ((t.dataInclusao ?? 0) > (best.dataInclusao ?? 0) ? t : best));
}

// ----------------------------------------------------------------------------
// Normalização de UMA intimação
// ----------------------------------------------------------------------------

export async function normalizeIntimacao(
  pj: ProjurisClient,
  intim: Record<string, unknown>,
): Promise<NormalizedIntimacao> {
  const alerts: string[] = [];
  const codigoIntimacao = asNum(intim.codigoIntimacao);
  const numeroProcesso = asStr(intim.numeroProcesso);
  const codigoProcesso = asNum(intim.codigoProcesso);
  const dataDisp = asNum(intim.dataDisponibilizacao);

  // responsável (da intimação): usuariosResponsaveis[0].codigoUsuario
  let responsavel_cod: number | null = null;
  const usrs = intim.usuariosResponsaveis;
  if (Array.isArray(usrs) && usrs.length) {
    responsavel_cod = asNum((usrs[0] as Record<string, unknown>)?.codigoUsuario);
  }
  const responsavel_nome = asStr(intim.nomeResponsavel);

  const tema_candidatos: TemaCandidatos = {
    assunto: null,
    assuntoCnj: null,
    marcadores: [],
    camposPersonalizados: [],
  };
  let tipo_tarefa_codigo: number | null = null;
  let tipo_tarefa_nome: string | null = null;
  let prazo_previsto_data: number | null = null;
  let prazo_fatal_data: number | null = null;
  let tarefasCount = 0;

  if (codigoProcesso === null) {
    alerts.push("intimacao sem codigoProcesso · sem tema/tipo/prazo");
  } else {
    // (a) PROCESSO → tema candidatos
    try {
      const proc = await fetchProcesso(pj, codigoProcesso);
      tema_candidatos.assunto = asStr(proc.assunto);
      tema_candidatos.assuntoCnj = asStr(proc.assuntoCnj);
      tema_candidatos.marcadores = marcadorNames(proc.marcadorWs);
      const campos = proc.campoDinamicoDadoWs;
      if (Array.isArray(campos)) {
        tema_candidatos.camposPersonalizados = campos.map((c) =>
          flattenCampo(c as Record<string, unknown>),
        );
      }
    } catch (err) {
      alerts.push(
        `falha ao ler processo ${codigoProcesso}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // (b) TAREFA(s) → tipo + prazos
    try {
      const tarefas = await fetchTarefasDoProcesso(pj, codigoProcesso);
      tarefasCount = tarefas.length;
      const t = pickTarefa(tarefas);
      if (t) {
        tipo_tarefa_codigo = asNum(t.codigoTarefaTipo);
        tipo_tarefa_nome = asStr(t.nomeTarefaTipo);
        prazo_previsto_data = asNum(t.dataConclusaoPrevista);
        prazo_fatal_data = asNum(t.dataLimite);
      } else {
        alerts.push(`processo ${codigoProcesso} sem tarefa associada · sem tipo/prazo`);
      }
    } catch (err) {
      alerts.push(
        `falha ao ler tarefas do processo ${codigoProcesso}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const tema_resolvido = resolveTema(tema_candidatos);

  return {
    codigoIntimacao,
    numeroProcesso,
    codigoProcesso,
    tipo_tarefa_codigo,
    tipo_tarefa_nome,
    tema_candidatos,
    tema_resolvido,
    prazo_previsto: diffDays(prazo_previsto_data, dataDisp),
    prazo_fatal: diffDays(prazo_fatal_data, dataDisp),
    prazo_previsto_data,
    prazo_fatal_data,
    responsavel_cod,
    responsavel_nome,
    data_disponibilizacao: dataDisp,
    _tarefas_no_processo: tarefasCount,
    alerts,
  };
}

// ----------------------------------------------------------------------------
// Consulta + normalização em lote
// ----------------------------------------------------------------------------

export interface NormalizeOptions {
  /** Máximo de intimações a normalizar (amostra p/ teste). Default 20. */
  limit?: number;
  /** Filtro de data ProJuris. Default DATA_DA_DISPONIBILIZACAO. */
  tipoDataFiltro?: "DATA_DA_DISPONIBILIZACAO" | "DATA_DO_JORNAL";
  /** Concorrência dos GETs de processo/tarefa. Default 4. */
  concurrency?: number;
}

/**
 * Puxa a consulta de intimações (POST /intimacao/consulta = leitura) no período
 * e normaliza uma AMOSTRA (limit). Retorna { totalRegistros, itens[] }.
 *
 * O client deve estar autenticado OU o método autentica sob demanda (o client
 * cacheia o token). Recomendado autenticar antes via authenticateTryingVariants().
 */
export async function normalizeIntimacoes(
  pj: ProjurisClient,
  dataInicial: string, // YYYY-MM-DD
  dataFinal: string, // YYYY-MM-DD
  opts: NormalizeOptions = {},
): Promise<{ totalRegistros: number; itens: NormalizedIntimacao[] }> {
  const limit = opts.limit ?? 20;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const resp = await pj.projurisPostConsulta<{
    totalRegistros?: number;
    intimacaoConsultaWs?: Array<Record<string, unknown>>;
  }>("intimacao/consulta", {
    tipoDataFiltroIntimacao: opts.tipoDataFiltro ?? "DATA_DA_DISPONIBILIZACAO",
    dataPeriodoInicial: dataInicial,
    dataPeriodoFinal: dataFinal,
    dadosOrigemFiltro: true,
  });

  const totalRegistros = resp.totalRegistros ?? 0;
  const bruto = (resp.intimacaoConsultaWs ?? []).slice(0, limit);

  // Normaliza com concorrência limitada (cada item faz 2 GETs).
  const itens: NormalizedIntimacao[] = new Array(bruto.length);
  let idx = 0;
  async function worker() {
    for (;;) {
      const i = idx++;
      if (i >= bruto.length) return;
      itens[i] = await normalizeIntimacao(pj, bruto[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, bruto.length) }, worker));

  return { totalRegistros, itens };
}
