// Server-only — Tipos de Serviço + Etapas de pipeline (configuráveis) e
// movimentação de casos por etapa. Dual-write: a UI move por stage, mas
// gravamos macrostatus_* = slug da etapa (o trigger projeta stage_*), mantendo
// a bifurcação atual intacta (ADR-007).

import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class PipelineServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PipelineServiceError";
  }
}

export type StageKind = "op" | "fin";

// ----------------------------------------------------------- Tipos de Serviço
export async function listServiceTypes() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_service_types_active")
    .select("*")
    .eq("active", true)
    .order("ordem", { ascending: true });
  if (error) throw new PipelineServiceError(error.message, 500);
  return data ?? [];
}

export async function createServiceType(input: { name: string; slug: string; ordem?: number }) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_service_types")
    .insert({ organization_id: DEFAULT_ORG, name: input.name, slug: input.slug, ordem: input.ordem ?? 0 })
    .select()
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao criar tipo", 500);
  return data;
}

// ------------------------------------------------------------------- Etapas
export async function listStages(serviceTypeId: string, kind: StageKind) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_pipeline_stages_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .eq("kind", kind)
    .order("ordem", { ascending: true });
  if (error) throw new PipelineServiceError(error.message, 500);
  return data ?? [];
}

export async function createStage(input: {
  service_type_id: string;
  kind: StageKind;
  slug: string;
  label: string;
  stage_role?: string;
  color?: string | null;
  ordem?: number;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_pipeline_stages")
    .insert({
      organization_id: DEFAULT_ORG,
      service_type_id: input.service_type_id,
      kind: input.kind,
      slug: input.slug,
      label: input.label,
      stage_role: input.stage_role ?? "normal",
      color: input.color ?? null,
      ordem: input.ordem ?? 0,
    })
    .select()
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao criar etapa", 500);
  return data;
}

export async function updateStage(
  id: string,
  patch: Partial<{ label: string; stage_role: string; color: string | null; ordem: number; active: boolean }>,
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_pipeline_stages")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao atualizar etapa", 500);
  return data;
}

export async function reorderStages(ids: string[]) {
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb.from("system_pipeline_stages").update({ ordem: i }).eq("id", ids[i]);
    if (error) throw new PipelineServiceError(error.message, 500);
  }
  return { ok: true as const };
}

export async function softDeleteStage(id: string) {
  const sb = getSupabaseAdmin();
  // Bloqueia remover etapa com casos parados nela.
  const { count } = await sb
    .from("system_cases")
    .select("id", { count: "exact", head: true })
    .or(`stage_op_id.eq.${id},stage_fin_id.eq.${id}`)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new PipelineServiceError("Há casos nesta etapa — remaneje antes de excluir", 409);
  }
  const { error } = await sb
    .from("system_pipeline_stages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new PipelineServiceError(error.message, 500);
  return { ok: true as const, id };
}

// ------------------------------------------------------------------- Casos
export async function listCasesByServiceType(serviceTypeId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .order("created_at", { ascending: false });
  if (error) throw new PipelineServiceError(error.message, 500);
  return data ?? [];
}

// Move o caso para uma etapa op. Dual-write: grava macrostatus_op = slug
// (o trigger projeta stage_op_id) — mantém a bifurcação atual funcionando.
export async function moveCaseToStageOp(caseId: string, stageId: string) {
  const sb = getSupabaseAdmin();
  const { data: stage, error: sErr } = await sb
    .from("system_pipeline_stages")
    .select("slug, kind")
    .eq("id", stageId)
    .single();
  if (sErr || !stage || stage.kind !== "op") throw new PipelineServiceError("Etapa operacional inválida", 422);

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_op: stage.slug })
    .eq("id", caseId)
    .select("id, stage_op_id, macrostatus_op")
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao mover caso", 500);
  return data;
}
