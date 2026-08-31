// Cadastrar um PROCESSO JUDICIAL no ProJuris a partir do caso do SHV.
//
// Pergunta do Thiago (31/08): "é possível cadastrarmos novo processo judicial no
// ProJuris, direto pela API através do SHV?" — é o "informar protocolo" do doc
// da Controladoria. Resposta: sim. `POST /processo-judicial` existe, e todas as
// listas que o formulário precisa também vêm da API (ver LISTAS_DE_APOIO), então
// o de-para não depende de ninguém digitar nada: o sistema pergunta ao ProJuris.
//
// CONTRATO — extraído do `ns1.xsd` oficial (docs/api-projuris/) e conferido
// contra processos REAIS lidos por `GET /processo/{codigo}`:
//
//   · O corpo é um ENVELOPE. `processoJudicialDadosType` acrescenta os campos
//     judiciais (instância, órgão, classe, assunto CNJ, segredo de justiça) ao
//     `processoDadosComunsType`, que carrega os 62 campos comuns a qualquer
//     processo (pasta, assunto, vara, datas, valores, responsáveis).
//   · Campo de lista/valor é sempre `{ chave, valor }` (simpleDtoType) — e para
//     ESCREVER basta a `chave`. Foi assim que os processos reais vieram.
//   · O NÚMERO CNJ **não é um campo simples**: vai em `processoNumerosWs`, uma
//     lista de `{ tipoNumeracao, numeroDoProcesso, principal }`. Essa é a
//     pegadinha que faria o cadastro falhar sem ler o XSD.
//   · Datas seguem a mesma regra já descoberta no `POST /tarefa`: epoch em
//     MILISSEGUNDOS, não "YYYY-MM-DD" (string devolve 500 sem explicar).
//
// GARANTIAS (as mesmas de todo write-back daqui — ver writeback-acoes.ts):
//   1. TRAVA DE BANCO: `system_distribution_config.projuris_writeback_ativo`.
//      Desligada = monta o corpo e NÃO envia. Nasce desligada.
//   2. MONTAGEM SEPARADA DO ENVIO: `montarProcessoJudicial()` é pura, então dá
//      para olhar exatamente o que iria antes de escrever na base de terceiro.
//   3. NUNCA lança para o chamador: devolve `{ enviado, motivo }`.
//
// ⚠️ ESTADO: o corpo é montado a partir do contrato oficial, mas o endpoint
// AINDA NÃO FOI EXERCITADO em produção — fazer isso cria um processo real no
// ProJuris do escritório, e isso exige autorização explícita. Use
// `scripts/preview-processo-projuris.ts` para conferir o corpo antes.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig } from "@/lib/distribuicao/sync-core";
import { isWritebackAtivo } from "@/lib/projuris/writeback-acoes";

/**
 * Rotas que alimentam o formulário. Todas testadas em 31/08 e respondendo:
 * as três primeiras devolvem `{ simpleDto: [...] }` (lista plana) e as duas
 * árvores devolvem `{ nodeWs: [...] }` (hierarquia CNJ, com filhos em `nodeWs`).
 */
export const LISTAS_DE_APOIO = {
  areas: "processo/area",
  tiposVara: "processo/vara-tipo",
  justicas: "processo/captura/dados-auxiliar/justica",
  situacoes: "processo/situacao",
  /** Árvore de classes CNJ. */
  classes: "processo/classe",
  /** Árvore de assuntos CNJ. */
  assuntos: "processo/assunto",
} as const;

/** Item de lista do ProJuris. Para escrever, só a `chave` importa. */
export type SimpleDto = { chave: number; valor?: string };

export interface NovoProcessoJudicial {
  /** Número CNJ. Entra em `processoNumerosWs`, não como campo solto. */
  numeroCnj: string;
  /** Nome da pasta lá (o SHV manda o nome do caso/cliente). */
  nomePasta: string;
  /** Assunto em texto livre — é o que aparece na lista de processos. */
  assunto: string;
  /** Chaves vindas das LISTAS_DE_APOIO. */
  codigoJustica?: number | null;
  codigoArea?: number | null;
  codigoClasseCnj?: number | null;
  codigoAssuntoCnj?: number | null;
  codigoOrgaoJudicial?: number | null;
  codigoVara?: number | null;
  codigoTipoVara?: number | null;
  codigoSituacao?: number | null;
  /** "YYYY-MM-DD" — convertida para epoch ms. */
  dataDistribuicao?: string | null;
  valorAcao?: number | null;
  segredoJustica?: boolean;
  /** Códigos de usuário do ProJuris (system_projuris_executor_mapping). */
  codigosResponsaveis?: number[];
  /** Amarra o processo ao caso do SHV do outro lado. */
  codigoExterno?: string | null;
}

/**
 * Data "YYYY-MM-DD" → epoch em MILISSEGUNDOS, ancorada ao MEIO-DIA UTC.
 * À meia-noite o fuso de Brasília (-03) jogaria a data para o dia anterior.
 * Mesma regra já usada em criar-tarefa.ts.
 */
function comoData(v: string | null | undefined): number | null {
  if (!v) return null;
  const d = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const ms = Date.parse(`${d}T12:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function dto(chave: number | null | undefined): SimpleDto | undefined {
  return typeof chave === "number" && chave > 0 ? { chave } : undefined;
}

/** Remove as chaves vazias — o ProJuris rejeita `null` em campo de lista. */
function semVazios<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete o[k];
  }
  return o;
}

/**
 * Monta o corpo do `POST /processo-judicial`. PURA — não fala com ninguém.
 * É o que permite conferir o envio antes de gravar na base de terceiro.
 */
export function montarProcessoJudicial(input: NovoProcessoJudicial): Record<string, unknown> {
  const numero = (input.numeroCnj ?? "").replace(/\D/g, "");

  return semVazios({
    // --- campos judiciais (processoJudicialDadosType) ---
    orgaoJudicial: dto(input.codigoOrgaoJudicial),
    classeCnj: dto(input.codigoClasseCnj),
    assuntoCnj: dto(input.codigoAssuntoCnj),
    segredoJustica: input.segredoJustica ?? false,

    // --- campos comuns (processoDadosComunsType) ---
    nomePasta: input.nomePasta,
    assunto: input.assunto,
    tipoProcesso: "JUDICIAL",
    tipoJustica: dto(input.codigoJustica),
    area: dto(input.codigoArea),
    vara: dto(input.codigoVara),
    tipoVara: dto(input.codigoTipoVara),
    situacaoProcesso: dto(input.codigoSituacao),
    dataDistribuicao: comoData(input.dataDistribuicao),
    valorAcao: typeof input.valorAcao === "number" ? input.valorAcao : undefined,
    responsaveis: (input.codigosResponsaveis ?? []).map((chave) => ({ chave })),
    // Rastro do lado de lá: responde "de qual caso do SHV veio este processo?".
    codigoExterno: input.codigoExterno ?? undefined,

    // --- número CNJ: lista, não campo solto ---
    processoNumerosWs: numero
      ? [{ tipoNumeracao: "UNICO", numeroDoProcesso: numero, principal: true }]
      : undefined,
  });
}

export interface ResultadoCriacaoProcesso {
  /** Chegou a chamar o ProJuris? (false quando a trava está desligada.) */
  enviado: boolean;
  /** codigoProcesso devolvido por lá. */
  codigo?: string;
  /** Por que não enviou, ou o que deu errado. */
  motivo?: string;
  /** O corpo montado — sempre presente, mesmo sem enviar. */
  corpo: Record<string, unknown>;
}

/**
 * Cria o processo no ProJuris. Best-effort: nunca lança.
 *
 * `dryRun` (ou a trava de banco desligada) devolve o corpo montado sem enviar —
 * é o modo que se usa para conferir antes de escrever de verdade.
 */
export async function criarProcessoJudicial(
  input: NovoProcessoJudicial,
  opcoes?: { dryRun?: boolean },
): Promise<ResultadoCriacaoProcesso> {
  const corpo = montarProcessoJudicial(input);

  if (opcoes?.dryRun) {
    return { enviado: false, motivo: "dry-run: corpo montado, nada enviado", corpo };
  }
  if (!(await isWritebackAtivo())) {
    return {
      enviado: false,
      motivo: "escrita no ProJuris desligada (Configuração da Distribuição)",
      corpo,
    };
  }

  try {
    const client = await buildProjurisClientFromConfig(getSupabaseAdmin());
    // POST de escrita. `projurisPostConsulta` é só o transporte POST autenticado
    // (o nome vem do primeiro uso); aqui ele grava, e é por isso que só roda
    // depois da trava acima.
    const resp = await client.projurisPostConsulta<Record<string, unknown>>(
      "processo-judicial",
      corpo,
    );
    const codigo =
      (resp?.codigoProcesso as string | number | undefined) ??
      (resp?.chave as string | number | undefined);
    return { enviado: true, codigo: codigo != null ? String(codigo) : undefined, corpo };
  } catch (err) {
    return {
      enviado: false,
      motivo: err instanceof Error ? err.message : String(err),
      corpo,
    };
  }
}

/**
 * Carrega as listas que o formulário de cadastro precisa. Uma chamada por lista;
 * o ProJuris devolve `{ simpleDto: [...] }` nas planas e `{ nodeWs: [...] }` nas
 * árvores (classe e assunto CNJ).
 */
export async function carregarListasDeApoio(): Promise<Record<string, unknown>> {
  const client = await buildProjurisClientFromConfig(getSupabaseAdmin());
  const saida: Record<string, unknown> = {};
  for (const [nome, rota] of Object.entries(LISTAS_DE_APOIO)) {
    try {
      saida[nome] = await client.projurisGet(rota);
    } catch (err) {
      saida[nome] = { erro: err instanceof Error ? err.message : String(err) };
    }
  }
  return saida;
}

/** Busca no SHV o que já dá para preencher sozinho a partir do caso. */
export async function dadosDoCasoParaProcesso(
  caseId: string,
): Promise<Partial<NovoProcessoJudicial>> {
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("id, case_code, caso_pasta_nome, projuris_numero_processo")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!caso) return {};

  // O nome do cliente mora na view (o caso guarda só o client_id).
  const { data: comCliente } = await sb
    .from("system_cases_active")
    .select("client_name")
    .eq("id", caseId)
    .maybeSingle();

  const c = caso as {
    case_code: string;
    caso_pasta_nome?: string | null;
    // O CNJ do caso vem do vínculo com o ProJuris (o caso pode ter vários
    // processos; aqui interessa o principal já reconhecido).
    projuris_numero_processo?: string | null;
  };
  const clientName = (comCliente as { client_name?: string | null } | null)?.client_name ?? null;
  return {
    nomePasta: c.caso_pasta_nome || clientName || c.case_code,
    assunto: c.caso_pasta_nome || c.case_code,
    numeroCnj: c.projuris_numero_processo ?? "",
    // O código do caso vai junto: é o que amarra os dois lados depois.
    codigoExterno: c.case_code,
  };
}
