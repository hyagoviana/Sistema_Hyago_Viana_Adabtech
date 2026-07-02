// Server-only — Checklist por etapa (Sprint 2).
//   - CRUD dos DEFS de checklist (S2-02), ancorados em (service_type_id, stage_slug).
//   - Instanciação server-side dos ITENS ao entrar na etapa (S2-03, via RPC idempotente).
//   - Marcar item + gate de avanço (S2-04) + coexistência com DnD / desmarcar
//     required de etapa ultrapassada (S2-05).
//   - Sugestão por upload no Drive (S2-06, modo SUGESTÃO / parametrizável / desligado).
// NUNCA importe este arquivo em código que roda no browser.

import slugify from "slugify";

import { isAutoCheckEnabled, matchDocPattern } from "./checklist/doc-matcher";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class ChecklistServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ChecklistServiceError";
  }
}

function baseKey(label: string): string {
  const slug = slugify(label, { lower: true, strict: true, locale: "pt" }).replace(/-/g, "_");
  return slug || "item";
}

// ----------------------------------------------------------------------------
// DEFS — CRUD (S2-02). Ancorados em (service_type_id, stage_slug). NUNCA troca
// service_type_id/stage_slug/key de um def existente (chave de ancoragem).
// ----------------------------------------------------------------------------
export async function listChecklistDefs(serviceTypeId: string, stageSlug: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_stage_checklist_defs_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .eq("stage_slug", stageSlug)
    .order("ordem")
    .order("created_at");
  if (error) throw new ChecklistServiceError(error.message, 500);
  return data ?? [];
}

async function uniqueDefKey(
  serviceTypeId: string,
  stageSlug: string,
  label: string,
): Promise<string> {
  const sb = getSupabaseAdmin();
  const base = baseKey(label);
  const { data } = await sb
    .from("system_stage_checklist_defs_active")
    .select("key")
    .eq("service_type_id", serviceTypeId)
    .eq("stage_slug", stageSlug);
  const existing = new Set((data ?? []).map((r) => r.key));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export async function createChecklistDef(input: {
  service_type_id: string;
  stage_slug: string;
  label: string;
  ordem?: number;
  required?: boolean;
  expected_doc_pattern?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const key = await uniqueDefKey(input.service_type_id, input.stage_slug, input.label);

  let ordem = input.ordem;
  if (ordem === undefined) {
    const { data: last } = await sb
      .from("system_stage_checklist_defs_active")
      .select("ordem")
      .eq("service_type_id", input.service_type_id)
      .eq("stage_slug", input.stage_slug)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    ordem = (last?.ordem ?? -1) + 1;
  }

  const { data, error } = await sb
    .from("system_stage_checklist_defs")
    .insert({
      organization_id: DEFAULT_ORG,
      service_type_id: input.service_type_id,
      stage_slug: input.stage_slug,
      key,
      label: input.label,
      ordem,
      required: input.required ?? false,
      expected_doc_pattern: input.expected_doc_pattern ?? null,
    })
    .select()
    .single();
  if (error || !data) {
    if (error?.code === "23505")
      throw new ChecklistServiceError("Já existe um item com esse identificador na etapa", 409);
    throw new ChecklistServiceError(error?.message ?? "Falha ao criar item", 500);
  }
  return data;
}

// Só altera label/ordem/required/active/expected_doc_pattern. NUNCA a ancoragem.
export async function updateChecklistDef(
  id: string,
  patch: Partial<{
    label: string;
    ordem: number;
    required: boolean;
    active: boolean;
    expected_doc_pattern: string | null;
  }>,
) {
  const sb = getSupabaseAdmin();
  const clean: Record<string, unknown> = {};
  if (patch.label !== undefined) clean.label = patch.label;
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;
  if (patch.required !== undefined) clean.required = patch.required;
  if (patch.active !== undefined) clean.active = patch.active;
  if (patch.expected_doc_pattern !== undefined)
    clean.expected_doc_pattern = patch.expected_doc_pattern;

  const { data, error } = await sb
    .from("system_stage_checklist_defs")
    .update(clean as never)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new ChecklistServiceError(error?.message ?? "Item não encontrado", 404);
  return data;
}

export async function reorderChecklistDefs(ids: string[]) {
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb
      .from("system_stage_checklist_defs")
      .update({ ordem: i })
      .eq("id", ids[i])
      .is("deleted_at", null);
    if (error) throw new ChecklistServiceError(error.message, 500);
  }
  return { ok: true as const };
}

// Soft-delete do DEF. NÃO apaga instâncias já criadas (items done permanecem).
export async function softDeleteChecklistDef(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_stage_checklist_defs")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new ChecklistServiceError(error.message, 500);
  return { ok: true as const, id };
}

// Conta itens de checklist ancorados numa etapa (usado pelo bloqueio de delete de
// etapa em uso — S2-02 estende softDeleteStage).
export async function countChecklistItemsForStage(
  serviceTypeId: string,
  stageSlug: string,
): Promise<number> {
  const sb = getSupabaseAdmin();
  // itens instanciados de casos daquele tipo naquela etapa
  const { count } = await sb
    .from("system_case_checklist_items")
    .select("id, def:system_stage_checklist_defs!inner(service_type_id)", {
      count: "exact",
      head: true,
    })
    .eq("stage_slug", stageSlug)
    .eq("def.service_type_id", serviceTypeId)
    .is("deleted_at", null);
  return count ?? 0;
}

// ----------------------------------------------------------------------------
// ITENS — leitura por caso.
// ----------------------------------------------------------------------------
export async function listCaseChecklistItems(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_checklist_items")
    .select("*, def:system_stage_checklist_defs(key, label, ordem, required, expected_doc_pattern)")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("stage_slug")
    .order("created_at");
  if (error) throw new ChecklistServiceError(error.message, 500);
  return data ?? [];
}

// ----------------------------------------------------------------------------
// INSTANCIAÇÃO SERVER-SIDE (S2-03) — idempotente via RPC. Chamada DENTRO da
// transição de etapa (pipeline-service/cases-service), nunca pelo front.
// ----------------------------------------------------------------------------
export async function instanciarChecklist(caseId: string, stageSlug: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc("system_fn_instanciar_checklist", {
    p_case_id: caseId,
    p_stage_slug: stageSlug,
  });
  if (error) throw new ChecklistServiceError(error.message, 500);
  return { ok: true as const };
}

// ----------------------------------------------------------------------------
// GATE (S2-04) — dispara a função idempotente de avanço por checklist.
// ----------------------------------------------------------------------------
export async function avancarSeChecklistOk(caseId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc("system_fn_avancar_se_checklist_ok", {
    p_case_id: caseId,
    p_triggered_by: triggeredBy ?? null,
  });
  if (error) throw new ChecklistServiceError(error.message, 500);
  return { ok: true as const };
}

// ----------------------------------------------------------------------------
// MARCAR ITEM (S2-04 + S2-05) — server-side.
//   - grava done/done_at/done_by;
//   - done=true na etapa ATUAL → dispara o gate (pode avançar);
//   - done=false de item required de etapa JÁ ULTRAPASSADA → NÃO regride;
//     grava evento 'checklist_inconsistente' (S2-05 CA-3).
// ----------------------------------------------------------------------------
export async function marcarItemChecklist(itemId: string, done: boolean, userId?: string) {
  const sb = getSupabaseAdmin();

  // Carrega o item + a etapa a que pertence + o caso.
  const { data: item, error: iErr } = await sb
    .from("system_case_checklist_items")
    .select("id, case_id, stage_slug, def_id, organization_id")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();
  if (iErr || !item) throw new ChecklistServiceError("Item de checklist não encontrado", 404);

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, macrostatus_op, service_type_id, organization_id")
    .eq("id", item.case_id)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new ChecklistServiceError("Caso não encontrado", 404);

  // Atualiza estado do item.
  const { data: updated, error: uErr } = await sb
    .from("system_case_checklist_items")
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? (userId ?? null) : null,
    })
    .eq("id", itemId)
    .is("deleted_at", null)
    .select()
    .single();
  if (uErr || !updated)
    throw new ChecklistServiceError(uErr?.message ?? "Falha ao marcar item", 500);

  if (done) {
    // done=true → tenta avançar (o gate só promove a partir da etapa esperada;
    // se o card já foi movido à frente por DnD, a guarda não casa → no-op).
    await avancarSeChecklistOk(item.case_id, userId);
    return updated;
  }

  // done=false → checar se o item é required de uma etapa JÁ ULTRAPASSADA.
  if (caso.service_type_id && caso.macrostatus_op && item.stage_slug !== caso.macrostatus_op) {
    // ordem da etapa do item e da etapa atual do caso.
    const { data: stages } = await sb
      .from("system_pipeline_stages")
      .select("slug, ordem")
      .eq("service_type_id", caso.service_type_id)
      .eq("kind", "op")
      .in("slug", [item.stage_slug, caso.macrostatus_op])
      .is("deleted_at", null);
    const itemOrdem = stages?.find((s) => s.slug === item.stage_slug)?.ordem;
    const currentOrdem = stages?.find((s) => s.slug === caso.macrostatus_op)?.ordem;

    // etapa do item é anterior à atual → ultrapassada.
    if (itemOrdem !== undefined && currentOrdem !== undefined && itemOrdem < currentOrdem) {
      const { data: def } = await sb
        .from("system_stage_checklist_defs")
        .select("required, key")
        .eq("id", item.def_id)
        .single();
      if (def?.required) {
        // NÃO regride; grava alerta/evento de inconsistência.
        await sb.from("system_case_events").insert({
          case_id: item.case_id,
          organization_id: caso.organization_id,
          action: "checklist_inconsistente",
          diff: {
            def_key: def.key,
            stage_slug: item.stage_slug,
            etapa_atual: caso.macrostatus_op,
          },
          triggered_by: userId ?? null,
        });
      }
    }
  }

  return updated;
}

// ----------------------------------------------------------------------------
// SUGESTÃO POR UPLOAD (S2-06) — modo SUGESTÃO. NÃO marca done. Dedupe por
// drive_file_id. DESLIGADA por padrão (AUTO_CHECK_DRIVE_ENABLED). Matcher
// parametrizável (aguardando convenção do owner).
// ----------------------------------------------------------------------------
export async function sugerirChecklistPorUpload(
  caseId: string,
  fileName: string,
  driveFileId: string,
): Promise<{ suggested: number; skipped: string }> {
  // Flag desligada → no-op (checklist manual funciona normalmente).
  if (!isAutoCheckEnabled()) return { suggested: 0, skipped: "disabled" };

  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, macrostatus_op, service_type_id, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso || !caso.service_type_id || !caso.macrostatus_op)
    return { suggested: 0, skipped: "no_case" };

  // Dedupe: mesmo drive_file_id não gera 2ª sugestão.
  const { data: existingFile } = await sb
    .from("system_case_checklist_items")
    .select("id")
    .eq("case_id", caseId)
    .eq("drive_file_id", driveFileId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingFile) return { suggested: 0, skipped: "dedupe" };

  // Itens da etapa atual com expected_doc_pattern; casa o matcher parametrizável.
  const { data: items } = await sb
    .from("system_case_checklist_items")
    .select("id, done, def:system_stage_checklist_defs(expected_doc_pattern)")
    .eq("case_id", caseId)
    .eq("stage_slug", caso.macrostatus_op)
    .is("deleted_at", null);

  let suggested = 0;
  for (const it of items ?? []) {
    const pattern = (it.def as { expected_doc_pattern: string | null } | null)
      ?.expected_doc_pattern;
    if (it.done) continue; // já concluído — não mexe
    if (!matchDocPattern(fileName, pattern)) continue;

    // Marca como sugestão (source='drive_suggest', done=false). NÃO fecha o gate.
    const { error } = await sb
      .from("system_case_checklist_items")
      .update({ source: "drive_suggest", drive_file_id: driveFileId })
      .eq("id", it.id)
      .is("deleted_at", null);
    if (!error) suggested++;
  }

  return { suggested, skipped: suggested > 0 ? "" : "no_match" };
}
