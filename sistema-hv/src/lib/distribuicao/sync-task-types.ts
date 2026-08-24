// Nucleo (server-only, Node) da SINCRONIZACAO DE TIPOS DE TAREFA do ProJuris
// (story H6). Espelha scripts/reconcile-projuris-tipos.ts (de-para por nome, A9
// v0.5) mas roda pelo Supabase admin client (nao pg direto) para ser chamado por
// uma server function (botao "Sincronizar tipos"). Idempotente.
//
// O QUE FAZ:
//   1) Autentica no ProJuris (SO LEITURA) via buildProjurisClientFromConfig (H11).
//   2) Puxa os tipos de tarefa: POST /tarefa-tipo/consulta — que além de código
//      e nome traz PRAZO PREVISTO/FATAL (prazoPadrao/prazoFatal), classificação
//      e o flag habilitado. (O antigo GET /tipo?chave-tipo=tarefa-tipo só dava
//      {chave,valor}; fica como fallback.)
//   3) Casa cada linha de system_task_type_mapping por NOME normalizado (sem
//      acento/caixa). Nome logico ESTAVEL (re-executavel): descricao > codigo-se-
//      placeholder > motor_task_type_id.
//   4) Para os que casam, UPDATE ... WHERE motor_task_type_id (chave estavel):
//      projuris_tipo_codigo = <codigo real>, projuris_tipo_descricao = <nome>.
//   5) Near-miss/ambiguo/colisao FICAM como estao — apenas reportados (owner
//      decide), NUNCA sobrescritos silenciosamente.
//
// SO LEITURA no ProJuris. A UNICA escrita e o UPDATE dos codigos (nosso banco).
//
// H7 (criar tipo no ProJuris) NAO esta aqui: depende de spike de endpoint de
// escrita na API (T0). Ver Dev Notes da story H6.

import { AuthError } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig } from "@/lib/distribuicao/sync-core";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

/** Normaliza nome p/ de-para (mesmo criterio do reconcile-projuris-tipos.ts). */
function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Desempacota GET /tipo?chave-tipo=tarefa-tipo → simpleDto[{chave,valor}]. */
function unwrapTipoSimpleDto(raw: unknown): Array<{ chave: unknown; valor: unknown }> {
  if (!raw || typeof raw !== "object") return [];
  const cont = (raw as Record<string, unknown>).consultaTipoRetorno;
  const bloco = Array.isArray(cont) ? cont[0] : cont;
  if (bloco && typeof bloco === "object") {
    const sd = (bloco as Record<string, unknown>).simpleDto;
    if (Array.isArray(sd)) return sd as Array<{ chave: unknown; valor: unknown }>;
  }
  return [];
}

interface Row {
  projuris_tipo_codigo: string | null;
  projuris_tipo_descricao: string | null;
  motor_task_type_id: string | null;
  archived_at?: string | null;
}

/** Um tipo de tarefa como o ProJuris devolve em /tarefa-tipo/consulta. */
interface TipoProjuris {
  codigo: string;
  nome: string;
  prazoPrevisto: number | null;
  prazoFatal: number | null;
  classificacao: string | null;
  habilitado: boolean | null;
}

/** Lê o catálogo completo de tipos (com prazos). Cai para o endpoint antigo se falhar. */
async function fetchTiposProjuris(pj: {
  projurisPostConsulta: <T>(p: string, b: unknown) => Promise<T>;
  projurisGet: <T>(p: string, q?: Record<string, string>) => Promise<T>;
}): Promise<TipoProjuris[]> {
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  try {
    const raw = await pj.projurisPostConsulta<{
      tarefaTipoConsultaWs?: Array<Record<string, unknown>>;
    }>("tarefa-tipo/consulta", { quantidadeRegistros: 1000, registroInicial: 0 });
    const arr = raw.tarefaTipoConsultaWs ?? [];
    if (arr.length > 0) {
      return arr
        .map((t) => ({
          codigo: t.codigoTarefaTipo != null ? String(t.codigoTarefaTipo) : "",
          nome: typeof t.nomeTipoTarefa === "string" ? t.nomeTipoTarefa : "",
          prazoPrevisto: num(t.prazoPadrao),
          prazoFatal: num(t.prazoFatal),
          classificacao: typeof t.classificacao === "string" ? t.classificacao : null,
          habilitado: typeof t.habilitado === "boolean" ? t.habilitado : null,
        }))
        .filter((t) => t.codigo && t.nome);
    }
  } catch {
    // cai para o fallback abaixo
  }
  const rawTipo = await pj.projurisGet<unknown>("tipo", { "chave-tipo": "tarefa-tipo" });
  return unwrapTipoSimpleDto(rawTipo)
    .map((t) => ({
      codigo: t.chave != null ? String(t.chave) : "",
      nome: typeof t.valor === "string" ? t.valor : String(t.valor ?? ""),
      prazoPrevisto: null,
      prazoFatal: null,
      classificacao: null,
      habilitado: null,
    }))
    .filter((t) => t.codigo && t.nome);
}

/** Nome logico ESTAVEL de uma linha do mapping (p/ casar por nome, re-executavel). */
function logicalName(row: Row): string {
  const desc = (row.projuris_tipo_descricao ?? "").trim();
  if (desc) return desc;
  const cod = (row.projuris_tipo_codigo ?? "").trim();
  if (cod && !/^\d+$/.test(cod)) return cod; // placeholder de NOME (ainda nao e codigo)
  return (row.motor_task_type_id ?? "").replace(/_/g, " ");
}

export interface SyncTaskTypesResult {
  /** Total de tipos lidos do ProJuris. */
  projurisTipos: number;
  /** Total de linhas SHV inspecionadas. */
  shvLinhas: number;
  /** Linhas que casaram e foram aplicadas (idempotente). */
  matched: Array<{ motor: string; nomeLogico: string; codigo: string; nome: string }>;
  /** Linhas sem correspondencia por nome (aguardam owner). */
  nearMiss: string[];
  /** Linhas cujo codigo ja foi usado por outra linha (UNIQUE) — aguardam owner. */
  collisions: string[];
  /** Quantas linhas ja tem codigo NUMERICO real apos a rodada. */
  numericos: number;
  /** Linhas que receberam prazo previsto/fatal vindo do ProJuris. */
  prazosAplicados: number;
  /** Tipos HABILITADOS que existiam só no ProJuris e foram criados aqui. */
  importados: string[];
}

/**
 * Sincroniza os codigos/descricoes dos tipos de tarefa a partir do ProJuris.
 * Idempotente: rodar 2x reescreve os mesmos valores, sem duplicar.
 */
export async function syncTaskTypesCore(): Promise<SyncTaskTypesResult> {
  const supabase = getSupabaseAdmin();

  // 1) ProJuris (leitura). Auth por config do banco (H11), tentando variantes.
  const pj = await buildProjurisClientFromConfig(supabase);
  await pj.authenticateTryingVariants();
  const tipos = await fetchTiposProjuris(pj);

  // Mapa NOME normalizado → tipo. O ProJuris tem DUPLICATAS de nome (o Thiago já
  // sinalizou; ex.: "Analise de caso" x3 com prazos diferentes). Regra: quando há
  // mais de um com o mesmo nome, fica com o que TEM prazo preenchido — se só um
  // tiver. Se nenhum ou vários tiverem, marcamos ambíguo e não tocamos na linha.
  const porNome = new Map<string, TipoProjuris[]>();
  for (const t of tipos) {
    const key = normalizeName(t.nome);
    const arr = porNome.get(key) ?? [];
    arr.push(t);
    porNome.set(key, arr);
  }

  // DESEMPATE (Thiago, 24/08): "das tarefas, já concluímos essa limpeza desde o
  // início do mês (...) tenho dito para puxarem direto da configuração do
  // ProJuris". E é isso mesmo: os duplicados continuam lá, porém DESABILITADOS —
  // 42 habilitados de 119. Antes olhávamos os 119 e víamos ambiguidade onde já
  // havia resposta ("Audiência" 1/3 desabilitado × 10/10 habilitado).
  //
  // Regra: o HABILITADO manda. Se não houver nenhum habilitado com aquele nome,
  // aceitamos o desabilitado — o SHV precisa manter o registro dos tipos antigos
  // para espelhar tarefas já existentes (pedido do Thiago em 08/08).
  const byName = new Map<string, TipoProjuris>();
  const ambiguousNames = new Set<string>();
  for (const [key, arr] of porNome) {
    const habilitados = arr.filter((t) => t.habilitado === true);
    const candidatos = habilitados.length > 0 ? habilitados : arr;

    if (candidatos.length === 1) {
      byName.set(key, candidatos[0]);
      continue;
    }
    // Ainda empatado: fica com o único que tem prazo preenchido, se houver.
    const comPrazo = candidatos.filter((t) => t.prazoPrevisto != null || t.prazoFatal != null);
    if (comPrazo.length === 1) byName.set(key, comPrazo[0]);
    else ambiguousNames.add(key);
  }

  // 2) SHV mapping (org default).
  const { data, error } = await supabase
    .from("system_task_type_mapping")
    .select("projuris_tipo_codigo, projuris_tipo_descricao, motor_task_type_id, archived_at")
    .eq("organization_id", ORG_ID)
    .order("motor_task_type_id");
  if (error) throw new AuthError(`Falha ao ler tipos de tarefa: ${error.message}`, 500);
  const rows = (data ?? []) as Row[];

  const matched: SyncTaskTypesResult["matched"] = [];
  const nearMiss: string[] = [];
  const collisions: string[] = [];
  let prazosAplicados = 0;

  // Dono ATUAL de cada código já gravado (o UNIQUE é contra o banco todo, não só
  // contra esta rodada). Sem isso, um código já usado por outra linha derrubava
  // o sync inteiro com erro de constraint.
  const codigoDono = new Map<string, string>();
  for (const r of rows) {
    const cod = (r.projuris_tipo_codigo ?? "").trim();
    if (/^[0-9]+$/.test(cod)) codigoDono.set(cod, r.motor_task_type_id ?? "");
  }

  for (const row of rows) {
    // Arquivado saiu de circulação por decisão nossa — não faz sentido cobrar
    // correspondência no ProJuris nem poluir o relatório com ele.
    if (row.archived_at) continue;

    const name = logicalName(row);
    const key = normalizeName(name);
    let hit = byName.get(key);
    const motor = row.motor_task_type_id ?? "(sem motor_id)";
    // 2ª chance: o ProJuris às vezes usa o rótulo completo ("Emenda à Inicial")
    // onde o SHV tem o curto ("Emenda"). Só aceitamos quando UM habilitado contém
    // o nome do SHV — mais de um seria chute.
    if (!hit && !ambiguousNames.has(key)) {
      const contidos = tipos.filter(
        (t) =>
          t.habilitado === true &&
          (normalizeName(t.nome).includes(key) || key.includes(normalizeName(t.nome))),
      );
      if (contidos.length === 1) hit = contidos[0];
    }

    if (hit && !ambiguousNames.has(key)) {
      const dono = codigoDono.get(hit.codigo);
      if (dono !== undefined && dono !== (row.motor_task_type_id ?? "")) {
        collisions.push(
          `${motor} (nome logico="${name}") → codigo ${hit.codigo} ja pertence a "${dono}" (UNIQUE) · nao aplicado`,
        );
        continue;
      }
      codigoDono.set(hit.codigo, row.motor_task_type_id ?? "");
      matched.push({ motor, nomeLogico: name, codigo: hit.codigo, nome: hit.nome });
      // Os prazos do ProJuris são a fonte da verdade (o Thiago corrigiu por lá).
      // Só sobrescrevemos quando o ProJuris TEM o valor — para não apagar um
      // prazo que alguém tenha ajustado no SHV.
      const patchPrazos: Record<string, unknown> = {};
      if (hit.prazoPrevisto != null) patchPrazos.prazo_previsto_dias = hit.prazoPrevisto;
      if (hit.prazoFatal != null) patchPrazos.prazo_fatal_dias = hit.prazoFatal;
      if (hit.classificacao) patchPrazos.projuris_classificacao = hit.classificacao;
      const trouxePrazo = Object.keys(patchPrazos).length > 0;

      const { error: upErr } = await supabase
        .from("system_task_type_mapping")
        .update({
          projuris_tipo_codigo: hit.codigo,
          projuris_tipo_descricao: hit.nome,
          ...patchPrazos,
          updated_at: new Date().toISOString(),
        })
        .eq("motor_task_type_id", row.motor_task_type_id ?? "")
        .eq("organization_id", ORG_ID);
      if (upErr) {
        // Best-effort por linha: registra e segue (antes, um único conflito
        // interrompia o sync e deixava o resto sem prazo).
        collisions.push(`${motor} → ${upErr.message}`);
        matched.pop();
        continue;
      }
      // Só conta DEPOIS de gravar — senão o relatório anuncia prazos que não foram.
      if (trouxePrazo) prazosAplicados++;
    } else {
      const jaVinculada = /^[0-9]+$/.test((row.projuris_tipo_codigo ?? "").trim());
      nearMiss.push(
        `${motor} (nome logico="${name}") → ${
          ambiguousNames.has(key)
            ? "AMBIGUO (multiplas variantes habilitadas com esse nome)"
            : jaVinculada
              ? "já vinculado por código, mas o nome não bate mais com o do ProJuris"
              : "sem correspondencia por nome"
        }`,
      );
    }
  }

  // 2b) IMPORTA os habilitados que o SHV ainda não tem.
  //
  // O Thiago mantém a configuração de tipos no ProJuris ("tenho dito para puxarem
  // direto da configuração"), então o que está habilitado lá e falta aqui é
  // simplesmente um tipo que o SHV ainda não conhece — inclusive as três
  // "Manifestação (5/10/15 dias)" que estavam pendentes desde 08/08.
  //
  // Entram com pontuação neutra (1) e sem classe: quem define isso é o escritório,
  // na tela de Configurações › Tipos de tarefa.
  const importados: string[] = [];
  const codigosNoShv = new Set([
    ...rows.map((r) => (r.projuris_tipo_codigo ?? "").trim()).filter(Boolean),
    // Inclui o que foi vinculado AGORA (ex.: "Emenda" ↔ "Emenda à Inicial"): sem
    // isto, a importação tentaria criar o mesmo código e bateria na UNIQUE.
    ...matched.map((m) => m.codigo),
  ]);
  const nomesNoShv = new Set(rows.map((r) => normalizeName(logicalName(r))));

  for (const t of tipos) {
    if (t.habilitado !== true) continue;
    if (codigosNoShv.has(t.codigo)) continue;
    if (nomesNoShv.has(normalizeName(t.nome))) continue;

    const slug = normalizeName(t.nome)
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const { error: insErr } = await supabase.from("system_task_type_mapping").insert({
      organization_id: ORG_ID,
      projuris_tipo_codigo: t.codigo,
      projuris_tipo_descricao: t.nome.trim(),
      motor_task_type_id: slug || t.codigo,
      points: 1,
      prazo_previsto_dias: t.prazoPrevisto,
      prazo_fatal_dias: t.prazoFatal,
      projuris_classificacao: t.classificacao,
      active: true,
    } as never);
    if (insErr) {
      collisions.push(`importar "${t.nome}" → ${insErr.message}`);
      continue;
    }
    codigosNoShv.add(t.codigo);
    nomesNoShv.add(normalizeName(t.nome));
    importados.push(
      `${t.nome} (${t.codigo}, prazo ${t.prazoPrevisto ?? "·"}/${t.prazoFatal ?? "·"})`,
    );
  }

  // 3) Confirmacao: quantos ficaram com codigo NUMERICO real.
  const { data: numData } = await supabase
    .from("system_task_type_mapping")
    .select("projuris_tipo_codigo")
    .eq("organization_id", ORG_ID);
  const numericos = (numData ?? []).filter((r) =>
    /^[0-9]+$/.test(String((r as { projuris_tipo_codigo: string }).projuris_tipo_codigo ?? "")),
  ).length;

  return {
    projurisTipos: tipos.length,
    shvLinhas: rows.length,
    matched,
    nearMiss,
    collisions,
    numericos,
    prazosAplicados,
    importados,
  };
}
