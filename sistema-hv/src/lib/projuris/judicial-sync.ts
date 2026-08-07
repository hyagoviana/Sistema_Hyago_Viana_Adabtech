// Server-only (Node) — SYNC de LEITURA do espelho JUDICIAL (Story G1).
//
// Dado um caso com `projuris_codigo_processo`, lê o ProJuris (SÓ LEITURA:
// projurisGet) — resumo do processo + tarefas do processo — resolve os
// responsáveis (código→nome via /usuario) e os tipos (código→nome via
// system_task_type_mapping) e faz UPSERT idempotente no espelho:
//   - system_case_judicial_processos (1 linha/caso)
//   - system_case_judicial_tasks     (1 linha/(caso, codigoTarefa))
//
// REGRA CRÍTICA (D1): ZERO escrita no ProJuris. Só projurisGet/projurisPostConsulta.
// A escrita acontece apenas nas 2 tabelas do NOSSO banco. Idempotente (upsert por
// chave). NUNCA importe este módulo no bundle do browser (segredos).

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";
import type { ProjurisClient } from "@/lib/projuris/client";

export class JudicialSyncError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JudicialSyncError";
  }
}

/** epoch-ms | dd/MM/yyyy | ISO -> YYYY-MM-DD | null (mesma lógica do sync-core). */
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

/** Encontra o 1o array (em profundidade) num payload de forma desconhecida. */
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

function asStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

// Mapa código→nome dos usuários ProJuris (/usuario → simpleDto[{chave,valor}]).
// Cacheado por processo de sync (é a mesma lista para todos os casos).
async function fetchUserMap(client: ProjurisClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = await client.projurisGet<{
      simpleDto?: Array<{ chave: unknown; valor: unknown }>;
    }>("usuario");
    const list =
      raw?.simpleDto ?? (firstArrayDeep(raw) as Array<{ chave: unknown; valor: unknown }>);
    for (const u of list ?? []) {
      const k = asStr(u.chave);
      const v = asStr(u.valor);
      if (k && v) map.set(k, v);
    }
  } catch {
    // /usuario indisponível → nomes ficam nulos (mostra código como fallback na UI).
  }
  return map;
}

// Extrai os responsáveis (códigos) de uma tarefa (usuarioResponsaveis[]).
function extractResponsaveis(t: Record<string, unknown>): string[] {
  const arr = t.usuarioResponsaveis;
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const r of arr) {
    if (r && typeof r === "object") {
      const cod =
        asStr((r as Record<string, unknown>).codigoUsuario) ??
        asStr((r as Record<string, unknown>).chave) ??
        asStr((r as Record<string, unknown>).codigo);
      if (cod) out.push(cod);
    } else {
      const cod = asStr(r);
      if (cod) out.push(cod);
    }
  }
  return out;
}

export interface JudicialSyncResult {
  ok: true;
  tarefas: number;
  processoAtualizado: boolean;
}

/**
 * Sincroniza (LEITURA) o espelho judicial de UM caso a partir do ProJuris.
 * Idempotente: re-rodar não duplica (upsert por chave). SÓ LEITURA no ProJuris.
 */
export async function syncCaseJudicial(caseId: string): Promise<JudicialSyncResult> {
  const sb = getSupabaseAdmin();

  const { data: caso, error: casoErr } = await sb
    .from("system_cases")
    .select("id, organization_id, projuris_codigo_processo")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (casoErr) throw new JudicialSyncError(casoErr.message, 500);
  if (!caso) throw new JudicialSyncError("Caso não encontrado", 404);
  const codigo = caso.projuris_codigo_processo;
  if (!codigo) {
    throw new JudicialSyncError("Caso sem processo ProJuris vinculado.", 422);
  }
  const orgId = caso.organization_id ?? ORG_ID;
  const pid = String(codigo);

  const client = await buildProjurisClientFromConfig(sb);
  await client.authenticateTryingVariants();

  const userMap = await fetchUserMap(client);

  // ---- 1) Processo (resumo) — SÓ LEITURA ----
  let processoAtualizado = false;
  try {
    const proc = await client.projurisGet<Record<string, unknown>>(`processo/${pid}`);
    const numero =
      asStr(proc.numeroProcesso) ?? asStr(proc.numeroProcessoUnico) ?? asStr(proc.numero);
    const tribunal =
      asStr(proc.tribunal) ?? asStr(proc.nomeTribunal) ?? asStr(proc.orgaoJulgador) ?? null;
    const orgao = asStr(proc.orgao) ?? asStr(proc.nomeOrgao) ?? asStr(proc.orgaoJulgador) ?? null;
    const fase = asStr(proc.fase) ?? asStr(proc.nomeFase) ?? null;
    const assunto = asStr(proc.assunto) ?? asStr(proc.nomeAssunto) ?? null;

    const { error: upErr } = await sb.from("system_case_judicial_processos").upsert(
      {
        organization_id: orgId,
        case_id: caseId,
        projuris_codigo_processo: codigo,
        numero_processo: numero,
        tribunal,
        orgao,
        fase,
        assunto,
        raw: proc as never,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "case_id" },
    );
    if (upErr) throw new JudicialSyncError(upErr.message, 500);
    processoAtualizado = true;
  } catch (err) {
    if (err instanceof JudicialSyncError) throw err;
    // Processo ilegível não derruba o sync das tarefas.
  }

  // ---- 2) Tarefas do processo — SÓ LEITURA ----
  let tarefasCount = 0;
  try {
    const raw = await client.projurisGet<unknown>(`processo/${pid}/tarefa/consulta-multi-modulo`);
    const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;

    // De-para de tipo (código→nome) via mapping do banco (fallback ao nome cru da tarefa).
    const { data: ttRows } = await sb
      .from("system_task_type_mapping")
      .select("projuris_tipo_codigo")
      .eq("organization_id", orgId);
    // (o nome do tipo vem direto da tarefa: nomeTarefaTipo; o mapping serve para
    // enriquecer no futuro — hoje usamos o nome cru quando presente.)
    void ttRows;

    const rows = arr.map((t) => {
      const codTarefa = asStr(t.codigoTarefa) ?? `${pid}-${asStr(t.codigoTarefaTipo) ?? ""}`;
      const resps = extractResponsaveis(t);
      const respCod = resps[0] ?? null;
      const respNome = respCod
        ? (userMap.get(respCod) ?? resps.map((c) => userMap.get(c) ?? c).join(", "))
        : null;
      return {
        organization_id: orgId,
        case_id: caseId,
        projuris_codigo_tarefa: codTarefa,
        tipo_codigo: asStr(t.codigoTarefaTipo),
        tipo_nome: asStr(t.nomeTarefaTipo),
        responsavel_projuris_cod: resps.length ? resps.join(",") : null,
        responsavel_nome: respNome,
        situacao: asStr(t.situacao) ?? (t.flagSituacaoConcluida === true ? "Concluída" : null),
        concluida: t.flagSituacaoConcluida === true,
        prazo_previsto: msToIso(t.dataConclusaoPrevista),
        prazo_fatal: msToIso(t.dataLimite),
        raw: t as never,
        synced_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      const { error: upErr } = await sb
        .from("system_case_judicial_tasks")
        .upsert(rows, { onConflict: "case_id,projuris_codigo_tarefa" });
      if (upErr) throw new JudicialSyncError(upErr.message, 500);
    }
    tarefasCount = rows.length;
  } catch (err) {
    if (err instanceof JudicialSyncError) throw err;
    // Falha nas tarefas não derruba o resumo do processo.
  }

  return { ok: true, tarefas: tarefasCount, processoAtualizado };
}

/**
 * Lê os ANDAMENTOS do processo (LEITURA, com limite/keyset) — G5. Não persiste;
 * devolve direto para o modal. `POST /v2/processo-andamento/consulta` = consulta.
 */
// Item de andamento serializável (JSON puro) — o payload cru do ProJuris é
// heterogêneo; devolvemos como JSON serializável para o front (createServerFn
// exige tipos serializáveis).
export type AndamentoItem = { [k: string]: string | number | boolean | null };

export async function listCaseJudicialAndamentos(
  caseId: string,
  limit = 30,
  offset = 0,
): Promise<{ items: AndamentoItem[]; hasMore: boolean }> {
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("projuris_codigo_processo")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  const codigo = caso?.projuris_codigo_processo;
  if (!codigo) return { items: [], hasMore: false };

  const client = await buildProjurisClientFromConfig(sb);
  await client.authenticateTryingVariants();

  try {
    const raw = await client.projurisPostConsulta<unknown>("v2/processo-andamento/consulta", {
      codigoProcesso: codigo,
      quantidadeRegistros: limit + 1,
      registroInicial: offset,
    });
    const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;
    const hasMore = arr.length > limit;
    // Achata cada andamento para primitivos serializáveis (o front só exibe texto).
    const items: AndamentoItem[] = arr.slice(0, limit).map((rec) => {
      const out: AndamentoItem = {};
      for (const [k, v] of Object.entries(rec)) {
        out[k] =
          v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
            ? (v as string | number | boolean | null)
            : JSON.stringify(v);
      }
      return out;
    });
    return { items, hasMore };
  } catch {
    return { items: [], hasMore: false };
  }
}
