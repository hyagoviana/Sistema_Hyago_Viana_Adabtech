// Server-only (Node) — LEITURA do DETALHE COMPLETO de um processo no ProJuris,
// para o drawer "abrir tudo do processo" da aba Lista (R2). SÓ LEITURA
// (projurisGet/projurisPostConsulta) — ZERO escrita. Não persiste nada: devolve
// o payload já normalizado (serializável) para o front.
//
// Reusa buildProjurisClientFromConfig (mesma auth do motor) e os mesmos padrões
// de parse comprovados no judicial-sync (a API ADV devolve muitos campos como
// {chave,valor} e datas como epoch-ms).
//
// NOTA (2026-08-17): a auth do ProJuris pode estar indisponível (erro de token no
// gateway deles). Neste caso as funções degradam para `ok:false` + `erro`, sem
// derrubar a tela. O campo ENVOLVIDOS é lido de forma DEFENSIVA (o nome exato da
// chave só foi confirmável com o ProJuris no ar); ajustar a lista de candidatos
// se o payload real trouxer outra chave.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig } from "@/lib/distribuicao/sync-core";
import type { ProjurisClient } from "@/lib/projuris/client";

// ---- helpers de parse (espelham judicial-sync) ----
function asStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}
function pickValor(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return asStr(o.valor) ?? asStr(o.nome) ?? asStr(o.descricao);
  }
  return asStr(v);
}
function msToIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v).toISOString().slice(0, 10);
  if (typeof v === "string") {
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    if (v.includes("T")) return v.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  return null;
}
function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") {
        const inner = firstArrayDeep(val);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

async function fetchUserMap(client: ProjurisClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = await client.projurisGet<{ simpleDto?: Array<{ chave: unknown; valor: unknown }> }>(
      "usuario",
    );
    const list =
      raw?.simpleDto ?? (firstArrayDeep(raw) as Array<{ chave: unknown; valor: unknown }>);
    for (const u of list ?? []) {
      const k = asStr(u.chave);
      const v = asStr(u.valor);
      if (k && v) map.set(k, v);
    }
  } catch {
    /* /usuario indisponível — nomes caem para o código */
  }
  return map;
}

// Extrai ENVOLVIDOS de forma defensiva (o nome da chave varia; tentamos as mais
// prováveis). Cada item vira { nome, papel } (papel = Autor/Réu/etc.).
// Chaves reais confirmadas contra o ProJuris (2026-08-17):
// processoEnvolvidoSimplificadoWs = [{ nomePessoaEnvolvido, participacaoTipo:"Autor",
// participacao:"PARTE_ATIVA", flagCliente, flagPrincipal }]. As demais ficam como
// fallback defensivo.
const ENVOLVIDO_KEYS = [
  "processoEnvolvidoSimplificadoWs",
  "processoEnvolvidoWs",
  "envolvidoWs",
  "envolvidos",
  "parteWs",
  "partesWs",
  "partes",
  "pessoaProcessoWs",
  "participanteWs",
  "poloWs",
];
function extractEnvolvidos(proc: Record<string, unknown>): ProcessoEnvolvido[] {
  let arr: unknown[] = [];
  for (const k of ENVOLVIDO_KEYS) {
    if (Array.isArray(proc[k]) && (proc[k] as unknown[]).length) {
      arr = proc[k] as unknown[];
      break;
    }
  }
  const out: ProcessoEnvolvido[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") {
      const s = asStr(it);
      if (s) out.push({ nome: s, papel: null });
      continue;
    }
    const o = it as Record<string, unknown>;
    const nome =
      asStr(o.nomePessoaEnvolvido) ??
      asStr(o.nome) ??
      asStr(o.nomePessoa) ??
      asStr(o.nomeParte) ??
      asStr(o.nomeEnvolvido) ??
      pickValor(o.pessoa) ??
      pickValor(o.valor);
    const papel =
      pickValor(o.participacaoTipo) ??
      pickValor(o.participacao) ??
      pickValor(o.papel) ??
      pickValor(o.tipoParticipacao) ??
      pickValor(o.tipoEnvolvido) ??
      pickValor(o.polo) ??
      pickValor(o.qualificacao) ??
      pickValor(o.tipo);
    if (nome) out.push({ nome, papel });
  }
  return out;
}

// Número CNJ real: processoNumeroWs = [{ numeroDoProcesso, principal, ... }].
function extractNumeroCnj(proc: Record<string, unknown>): string | null {
  const arr = proc.processoNumeroWs;
  if (Array.isArray(arr) && arr.length) {
    const principal =
      (arr as Array<Record<string, unknown>>).find((n) => n.principal === true) ??
      (arr[0] as Record<string, unknown>);
    const num = asStr(principal.numeroDoProcesso) ?? asStr(principal.numero);
    if (num) return num;
  }
  return null;
}

function extractResponsaveis(t: Record<string, unknown>, userMap: Map<string, string>): string[] {
  const arr = t.usuarioResponsaveis;
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const r of arr) {
    let cod: string | null = null;
    if (r && typeof r === "object") {
      const o = r as Record<string, unknown>;
      cod = asStr(o.codigoUsuario) ?? asStr(o.chave) ?? asStr(o.codigo);
    } else {
      cod = asStr(r);
    }
    if (cod) out.push(userMap.get(cod) ?? cod);
  }
  return out;
}

export interface ProcessoEnvolvido {
  nome: string;
  papel: string | null;
}
export interface ProcessoTarefa {
  codigo: string | null;
  tipo: string | null;
  responsaveis: string[];
  situacao: string | null;
  concluida: boolean;
  prazo_previsto: string | null;
  prazo_fatal: string | null;
  marcadores: string[];
}
export interface ProcessoDocumento {
  nome: string;
  data: string | null;
}
export interface ProcessoDetalhe {
  ok: boolean;
  erro: string | null;
  codigo: string;
  identificador: string | null;
  numero_processo: string | null;
  assunto: string | null;
  orgao: string | null;
  classe: string | null;
  situacao: string | null;
  instancia: string | null;
  vara: string | null;
  fase: string | null;
  valor_causa: string | null;
  data_distribuicao: string | null;
  monitoramento_push: boolean | null;
  envolvidos: ProcessoEnvolvido[];
  tarefas: ProcessoTarefa[];
  documentos: ProcessoDocumento[];
}

function empty(codigo: string, erro: string | null): ProcessoDetalhe {
  return {
    ok: erro === null,
    erro,
    codigo,
    identificador: null,
    numero_processo: null,
    assunto: null,
    orgao: null,
    classe: null,
    situacao: null,
    instancia: null,
    vara: null,
    fase: null,
    valor_causa: null,
    data_distribuicao: null,
    monitoramento_push: null,
    envolvidos: [],
    tarefas: [],
    documentos: [],
  };
}

/** Best-effort: tenta listar documentos do processo. Degrada para [] em erro. */
async function fetchDocumentos(
  client: ProjurisClient,
  codigo: string,
): Promise<ProcessoDocumento[]> {
  const endpoints = [`processo/${codigo}/documento`, `processo/${codigo}/documento/consulta`];
  for (const ep of endpoints) {
    try {
      const raw = await client.projurisGet<unknown>(ep);
      const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;
      if (arr.length) {
        return arr
          .map((d) => ({
            nome:
              asStr(d.nome) ??
              asStr(d.nomeArquivo) ??
              asStr(d.titulo) ??
              asStr(d.descricao) ??
              "(sem nome)",
            data: msToIso(d.dataInclusao ?? d.data ?? d.dataCriacao),
          }))
          .filter((d) => d.nome !== "(sem nome)" || d.data);
      }
    } catch {
      /* tenta o próximo endpoint */
    }
  }
  return [];
}

/**
 * Lê o detalhe COMPLETO de um processo no ProJuris (resumo + envolvidos +
 * tarefas + documentos best-effort). SÓ LEITURA. Degrada para ok:false + erro se
 * a auth/gateway do ProJuris estiver indisponível.
 */
export async function fetchProcessoDetalhe(codigoProcesso: string): Promise<ProcessoDetalhe> {
  const codigo = String(codigoProcesso);
  const sb = getSupabaseAdmin();
  let client: ProjurisClient;
  try {
    client = await buildProjurisClientFromConfig(sb);
    await client.authenticateTryingVariants();
  } catch (err) {
    return empty(codigo, err instanceof Error ? err.message : "Falha na autenticação do ProJuris");
  }

  const userMap = await fetchUserMap(client);

  let proc: Record<string, unknown>;
  try {
    proc = await client.projurisGet<Record<string, unknown>>(`processo/${codigo}`);
  } catch (err) {
    return empty(codigo, err instanceof Error ? err.message : "Processo indisponível no ProJuris");
  }

  const detalhe: ProcessoDetalhe = {
    ...empty(codigo, null),
    identificador: asStr(proc.identificador),
    numero_processo:
      asStr(proc.numeroProcesso) ??
      asStr(proc.numeroProcessoUnico) ??
      asStr(proc.numero) ??
      extractNumeroCnj(proc),
    assunto: asStr(proc.assunto) ?? asStr(proc.nomeAssunto),
    orgao: pickValor(proc.orgaoJudicial) ?? pickValor(proc.orgaoJulgador),
    classe: pickValor(proc.classeCnj),
    situacao: pickValor(proc.situacaoProcesso),
    instancia: pickValor(proc.instanciaCnj),
    vara: pickValor(proc.vara),
    fase: pickValor(proc.fase) ?? pickValor(proc.nomeFase),
    valor_causa:
      typeof proc.valorAcao === "number"
        ? proc.valorAcao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : pickValor(proc.valorAcao),
    data_distribuicao: msToIso(proc.dataDistribuicao),
    monitoramento_push: typeof proc.capturaHabilitada === "boolean" ? proc.capturaHabilitada : null,
    envolvidos: extractEnvolvidos(proc),
  };

  // Tarefas do processo (abertas e concluídas — o Kanban/detalhe mostra tudo).
  try {
    const raw = await client.projurisGet<unknown>(
      `processo/${codigo}/tarefa/consulta-multi-modulo`,
    );
    const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;
    detalhe.tarefas = arr.map((t) => ({
      codigo: asStr(t.codigoTarefa),
      tipo: asStr(t.nomeTarefaTipo) ?? asStr(t.codigoTarefaTipo),
      responsaveis: extractResponsaveis(t, userMap),
      situacao: asStr(t.situacao) ?? (t.flagSituacaoConcluida === true ? "Concluída" : "Pendente"),
      concluida: t.flagSituacaoConcluida === true,
      prazo_previsto: msToIso(t.dataConclusaoPrevista),
      prazo_fatal: msToIso(t.dataLimite),
      marcadores: (firstArrayDeep(t.marcadorWs) as unknown[])
        .map((m) => pickValor(m))
        .filter((s): s is string => !!s),
    }));
  } catch {
    /* tarefas indisponíveis não derrubam o resumo */
  }

  detalhe.documentos = await fetchDocumentos(client, codigo);

  return detalhe;
}
