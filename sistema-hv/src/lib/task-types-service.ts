// TIPOS DE TAREFA — catálogo ÚNICO do sistema (doc "21.08 _ Controladoria").
//
// Até aqui o tipo de tarefa era "coisa do motor de distribuição": morava dentro
// da Controladoria e falava o vocabulário das manifestações do ProJuris. O doc do
// Thiago sobe o tipo de tarefa para o nível do SISTEMA:
//
//   "Não é o tipo de tarefa do motor. É o tipo de tarefa do sistema.
//    Daqui [configurações] ele só vai puxar para lá [motor]."
//
// Quem consome este catálogo: o motor de distribuição, os workflows (filtro do
// gatilho por tipo), o dossiê do caso (tarefa manual) e o comercial.
//
// A TABELA continua sendo `system_task_type_mapping` — de propósito. Ela já tem
// pontuação, complexidade, prazos em dias e executor exclusivo, e o motor que
// roda em produção já lê tudo isso. Criar uma tabela paralela significaria
// duplicar catálogo e reconciliar dois vocabulários. O que a migration
// 20260824000001 fez foi ADICIONAR o que faltava para ela virar entidade de
// sistema: classe, flag do motor, arquivamento e vínculo opcional ao ProJuris.

import { AuthError } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const ORG_ID = "00000000-0000-0000-0000-000000000001";

/** Classes internas do SHV (doc 21.08) — NÃO confundir com a "Classificação" do ProJuris. */
export const TASK_TYPE_CLASSES = ["JUDICIAL", "ADMINISTRATIVO", "COMERCIAL", "FINANCEIRO"] as const;
export type TaskTypeClasse = (typeof TASK_TYPE_CLASSES)[number];

export const TASK_TYPE_CLASSE_LABEL: Record<TaskTypeClasse, string> = {
  JUDICIAL: "Judicial",
  ADMINISTRATIVO: "Administrativo",
  COMERCIAL: "Comercial",
  FINANCEIRO: "Financeiro",
};

export interface TaskType {
  id: string;
  nome: string;
  classe: TaskTypeClasse | null;
  points: number;
  complexity_level: number;
  temporal_level: number;
  prazo_previsto_dias: number | null;
  prazo_fatal_dias: number | null;
  aparece_no_motor: boolean;
  sync_projuris: boolean;
  active: boolean;
  archived_at: string | null;
  exclusive_executor_id: string | null;
  projuris_tipo_codigo: string;
  projuris_tipo_descricao: string | null;
  projuris_classificacao: string | null;
  /** Exceções de exclusivo por tema (carregadas junto — a UI precisa do Sim/Não). */
  excecoes: TaskTypeThemeExclusive[];
}

export interface TaskTypeThemeExclusive {
  id: string;
  task_type_id: string;
  tema_id: string;
  executor_id: string;
}

/** Filtro de estado da listagem (doc 21.08: "ativos / arquivados / todos"). */
export type TaskTypeEstado = "ativos" | "arquivados" | "todos";

export class TaskTypeError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "TaskTypeError";
  }
}

/** Nome de exibição: descrição do ProJuris quando existe, senão o id lógico do motor. */
function displayName(row: {
  projuris_tipo_descricao: string | null;
  projuris_tipo_codigo: string;
  motor_task_type_id: string;
}): string {
  return (
    row.projuris_tipo_descricao?.trim() ||
    (/^\d+$/.test(row.projuris_tipo_codigo) ? "" : row.projuris_tipo_codigo) ||
    row.motor_task_type_id.replace(/_/g, " ")
  );
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listTaskTypes(
  opts: { estado?: TaskTypeEstado; classe?: TaskTypeClasse | null; soMotor?: boolean } = {},
): Promise<TaskType[]> {
  const sb = getSupabaseAdmin();
  const { estado = "ativos", classe = null, soMotor = false } = opts;

  let q = sb.from("system_task_type_mapping").select("*").eq("organization_id", ORG_ID);
  if (estado === "ativos") q = q.is("archived_at", null);
  if (estado === "arquivados") q = q.not("archived_at", "is", null);
  if (classe) q = q.eq("classe", classe);
  if (soMotor) q = q.eq("aparece_no_motor", true).eq("active", true);

  const { data, error } = await q;
  if (error) throw new TaskTypeError(`Falha ao listar tipos de tarefa: ${error.message}`, 500);

  const { data: exc } = await sb
    .from("system_task_type_theme_exclusives")
    .select("id, task_type_id, tema_id, executor_id")
    .eq("organization_id", ORG_ID);

  const porTipo = new Map<string, TaskTypeThemeExclusive[]>();
  for (const e of exc ?? []) {
    const arr = porTipo.get(e.task_type_id) ?? [];
    arr.push(e);
    porTipo.set(e.task_type_id, arr);
  }

  return (data ?? [])
    .map((r) => ({
      id: r.id,
      nome: displayName(r),
      classe: (r.classe as TaskTypeClasse | null) ?? null,
      points: Number(r.points ?? 0),
      complexity_level: r.complexity_level,
      temporal_level: r.temporal_level,
      prazo_previsto_dias: r.prazo_previsto_dias,
      prazo_fatal_dias: r.prazo_fatal_dias,
      aparece_no_motor: r.aparece_no_motor,
      sync_projuris: r.sync_projuris,
      active: r.active,
      archived_at: r.archived_at,
      exclusive_executor_id: r.exclusive_executor_id,
      projuris_tipo_codigo: r.projuris_tipo_codigo,
      projuris_tipo_descricao: r.projuris_tipo_descricao,
      projuris_classificacao: r.projuris_classificacao,
      excecoes: porTipo.get(r.id) ?? [],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export interface TaskTypePatch {
  nome?: string;
  classe?: TaskTypeClasse | null;
  points?: number;
  complexity_level?: number;
  temporal_level?: number;
  prazo_previsto_dias?: number | null;
  prazo_fatal_dias?: number | null;
  aparece_no_motor?: boolean;
  sync_projuris?: boolean;
  exclusive_executor_id?: string | null;
}

/** Converte o patch da UI para as colunas reais (o "nome" mora na descrição do ProJuris). */
function toRow(patch: TaskTypePatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.nome !== undefined) row.projuris_tipo_descricao = patch.nome.trim();
  for (const k of [
    "classe",
    "points",
    "complexity_level",
    "temporal_level",
    "prazo_previsto_dias",
    "prazo_fatal_dias",
    "aparece_no_motor",
    "sync_projuris",
    "exclusive_executor_id",
  ] as const) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  return row;
}

export async function updateTaskType(id: string, patch: TaskTypePatch): Promise<void> {
  const sb = getSupabaseAdmin();
  const row = toRow(patch);
  if (Object.keys(row).length === 0) return;
  const { error } = await sb
    .from("system_task_type_mapping")
    .update(row as never)
    .eq("id", id)
    .eq("organization_id", ORG_ID);
  if (error) throw new TaskTypeError(`Falha ao salvar tipo de tarefa: ${error.message}`, 500);
}

/**
 * Cria um tipo de tarefa NOVO no catálogo do SHV.
 *
 * `projuris_tipo_codigo` é UNIQUE por org. Um tipo criado aqui ainda não existe
 * no ProJuris, então gravamos um código-placeholder derivado do nome; quando o
 * tipo for de fato criado lá (ou o sync casar por nome), `sync-task-types.ts`
 * substitui pelo código numérico real. É o mesmo contrato que o sync já usa.
 */
export async function createTaskType(input: TaskTypePatch & { nome: string }): Promise<string> {
  const sb = getSupabaseAdmin();
  const nome = input.nome.trim();
  if (!nome) throw new TaskTypeError("Informe o nome do tipo de tarefa");

  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const { data, error } = await sb
    .from("system_task_type_mapping")
    .insert({
      organization_id: ORG_ID,
      projuris_tipo_codigo: nome, // placeholder de NOME até o sync trazer o código real
      motor_task_type_id: slug,
      projuris_tipo_descricao: nome,
      ...toRow(input),
    } as never)
    .select("id")
    .single();
  if (error || !data)
    throw new TaskTypeError(
      error?.message?.includes("uq_task_type_projuris_org")
        ? "Já existe um tipo de tarefa com esse nome"
        : (error?.message ?? "Falha ao criar tipo de tarefa"),
      400,
    );
  return data.id;
}

/**
 * Arquiva / desarquiva. Arquivado some das listas de "criar tarefa" e do motor,
 * mas continua existindo para o legado e para o espelhamento de andamentos
 * (pedido explícito do Thiago em 08/08: "o SHV precisa manter o registro").
 */
export async function setTaskTypeArchived(id: string, archived: boolean): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_task_type_mapping")
    .update({ archived_at: archived ? new Date().toISOString() : null } as never)
    .eq("id", id)
    .eq("organization_id", ORG_ID);
  if (error) throw new TaskTypeError(`Falha ao arquivar tipo: ${error.message}`, 500);
}

// ---------------------------------------------------------------------------
// Exceções de executor exclusivo por TEMA
//   Regra geral  → system_task_type_mapping.exclusive_executor_id
//   Exceção      → aqui ("inicial do tema TMFC é da Patrícia")
// ---------------------------------------------------------------------------

export async function setThemeExclusive(
  taskTypeId: string,
  temaId: string,
  executorId: string,
  createdBy?: string,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("system_task_type_theme_exclusives").upsert(
    {
      organization_id: ORG_ID,
      task_type_id: taskTypeId,
      tema_id: temaId,
      executor_id: executorId,
      created_by: createdBy ?? null,
    } as never,
    { onConflict: "task_type_id,tema_id" },
  );
  if (error) throw new TaskTypeError(`Falha ao salvar exceção: ${error.message}`, 500);
}

export async function removeThemeExclusive(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_task_type_theme_exclusives")
    .delete()
    .eq("id", id)
    .eq("organization_id", ORG_ID);
  if (error) throw new TaskTypeError(`Falha ao remover exceção: ${error.message}`, 500);
}

/**
 * Executor exclusivo EFETIVO de um tipo num tema. Precedência (doc 21.08):
 *   1) exceção do par (tipo × tema)
 *   2) exclusivo geral do tipo
 *   3) nenhum → distribuição normal do motor
 * O exclusivo do TEMA (system_theme_mapping) continua sendo resolvido pelo motor.
 */
export async function resolveExclusiveExecutor(
  taskTypeId: string,
  temaId: string | null,
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (temaId) {
    const { data: exc } = await sb
      .from("system_task_type_theme_exclusives")
      .select("executor_id")
      .eq("task_type_id", taskTypeId)
      .eq("tema_id", temaId)
      .maybeSingle();
    if (exc?.executor_id) return exc.executor_id;
  }
  const { data: tipo } = await sb
    .from("system_task_type_mapping")
    .select("exclusive_executor_id")
    .eq("id", taskTypeId)
    .maybeSingle();
  return tipo?.exclusive_executor_id ?? null;
}

/** Guard usado pelos RPCs — mantém a mensagem de erro consistente. */
export function assertFound<T>(v: T | null | undefined, msg: string): T {
  if (v === null || v === undefined) throw new AuthError(msg, 404);
  return v;
}
