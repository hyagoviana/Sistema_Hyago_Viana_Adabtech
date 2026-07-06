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

  // Normaliza itens AD-HOC (S9-11): quando def_id IS NULL, o item carrega a
  // própria definição (label/required/ordem). Projetamos num `def` sintético para
  // a UI consumir com a mesma forma dos itens herdados do modelo, e marcamos
  // is_adhoc p/ diferenciar visualmente e liberar editar/excluir por caso.
  return (data ?? []).map((row) => {
    const r = row as typeof row & {
      def_id: string | null;
      label: string | null;
      required: boolean;
      ordem: number;
    };
    const isAdhoc = r.def_id == null;
    if (isAdhoc) {
      return {
        ...r,
        is_adhoc: true as const,
        def: {
          key: `adhoc:${r.id}`,
          label: r.label ?? "—",
          ordem: r.ordem ?? 0,
          required: r.required ?? false,
          expected_doc_pattern: null,
        },
      };
    }
    return { ...r, is_adhoc: false as const };
  });
}

// ----------------------------------------------------------------------------
// ITENS AD-HOC POR CASO (S9-11) — critérios EXTRAS que valem SÓ p/ este caso.
//   - def_id IS NULL; a definição (label/required/ordem) vive no próprio item.
//   - herdados do modelo (def_id NOT NULL) continuam vindo do editor de funil e
//     NÃO são editáveis por caso (só marcáveis). Ad-hoc pode criar/editar/excluir.
//   - o gate (op/fin) já considera required ad-hoc (migration 20260709000001);
//     por isso, após criar/editar/excluir, disparamos o(s) gate(s) da etapa —
//     remover/desobrigar um required ad-hoc pendente pode liberar o avanço.
// ----------------------------------------------------------------------------

// Carrega o caso (org + tipo + macrostatus) para validar a etapa do ad-hoc.
async function loadCaseForAdhoc(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("id, macrostatus_op, macrostatus_fin, service_type_id, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new ChecklistServiceError("Caso não encontrado", 404);
  return caso;
}

// Dispara o(s) gate(s) (op e/ou fin) da etapa informada. Cada gate só promove a
// partir da etapa esperada (guarda WHERE macrostatus_* = esperado) → seguro chamar.
async function dispararGatesDaEtapa(
  caseId: string,
  serviceTypeId: string | null,
  stageSlug: string,
  userId?: string,
) {
  const kinds = serviceTypeId
    ? await stageKindsForSlug(serviceTypeId, stageSlug)
    : new Set<"op" | "fin">();
  if (kinds.size === 0 || kinds.has("op")) await avancarSeChecklistOk(caseId, userId);
  if (kinds.has("fin")) await avancarFinSeOk(caseId, userId);
}

export async function createAdhocChecklistItem(input: {
  caseId: string;
  stageSlug: string;
  label: string;
  required?: boolean;
}) {
  const sb = getSupabaseAdmin();
  const label = input.label.trim();
  if (!label) throw new ChecklistServiceError("Informe o nome do critério", 400);

  const caso = await loadCaseForAdhoc(input.caseId);

  // ordem = próximo índice entre os itens (herdados + ad-hoc) da etapa, p/ o
  // novo critério aparecer ao final da lista da etapa.
  const { data: last } = await sb
    .from("system_case_checklist_items")
    .select("ordem")
    .eq("case_id", input.caseId)
    .eq("stage_slug", input.stageSlug)
    .is("deleted_at", null)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = ((last?.ordem as number | undefined) ?? -1) + 1;

  const { data, error } = await sb
    .from("system_case_checklist_items")
    .insert({
      organization_id: caso.organization_id,
      case_id: input.caseId,
      def_id: null,
      stage_slug: input.stageSlug,
      label,
      required: input.required ?? true,
      ordem,
      source: "manual",
      done: false,
    })
    .select()
    .single();
  if (error || !data)
    throw new ChecklistServiceError(error?.message ?? "Falha ao criar critério", 500);

  return data;
}

// Edita label/required de um item AD-HOC (def_id IS NULL). NUNCA edita herdado.
export async function updateAdhocChecklistItem(
  itemId: string,
  patch: { label?: string; required?: boolean },
  userId?: string,
) {
  const sb = getSupabaseAdmin();

  const { data: item, error: iErr } = await sb
    .from("system_case_checklist_items")
    .select("id, case_id, stage_slug, def_id")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();
  if (iErr || !item) throw new ChecklistServiceError("Critério não encontrado", 404);
  if (item.def_id != null)
    throw new ChecklistServiceError(
      "Critério herdado do modelo não pode ser editado neste caso. Edite no editor de funil.",
      409,
    );

  const clean: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) throw new ChecklistServiceError("Informe o nome do critério", 400);
    clean.label = label;
  }
  if (patch.required !== undefined) clean.required = patch.required;

  const { data, error } = await sb
    .from("system_case_checklist_items")
    .update(clean as never)
    .eq("id", itemId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new ChecklistServiceError(error?.message ?? "Falha ao editar critério", 500);

  // Tornar não-obrigatório um required pendente pode liberar o avanço.
  const caso = await loadCaseForAdhoc(item.case_id);
  await dispararGatesDaEtapa(item.case_id, caso.service_type_id, item.stage_slug, userId);

  return data;
}

// Soft-delete de um item AD-HOC (def_id IS NULL). NUNCA exclui herdado.
export async function deleteAdhocChecklistItem(itemId: string, userId?: string) {
  const sb = getSupabaseAdmin();

  const { data: item, error: iErr } = await sb
    .from("system_case_checklist_items")
    .select("id, case_id, stage_slug, def_id")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();
  if (iErr || !item) throw new ChecklistServiceError("Critério não encontrado", 404);
  if (item.def_id != null)
    throw new ChecklistServiceError(
      "Critério herdado do modelo não pode ser excluído neste caso. Exclua no editor de funil.",
      409,
    );

  const { error } = await sb
    .from("system_case_checklist_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .is("deleted_at", null);
  if (error) throw new ChecklistServiceError(error.message, 500);

  // Excluir um required ad-hoc pendente pode liberar o avanço.
  const caso = await loadCaseForAdhoc(item.case_id);
  await dispararGatesDaEtapa(item.case_id, caso.service_type_id, item.stage_slug, userId);

  return { ok: true as const, id: itemId };
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
// GATE (S2-04) — dispara a função idempotente de avanço por checklist (OP).
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
// GATE FIN (S3-02) — dispara a função idempotente de avanço por checklist na
// esteira FINANCEIRA. Molde do gate op; guarda WHERE macrostatus_fin = esperado.
// ----------------------------------------------------------------------------
export async function avancarFinSeOk(caseId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  // Cast: a função entra no types.ts só após db:types.
  const { error } = await sb.rpc(
    "system_fn_avancar_fin_se_ok" as never,
    {
      p_case_id: caseId,
      p_triggered_by: triggeredBy ?? null,
    } as never,
  );
  if (error) throw new ChecklistServiceError(error.message, 500);
  return { ok: true as const };
}

// Descobre se um stage_slug é etapa 'op' ou 'fin' de um tipo de serviço.
// Um mesmo slug pode existir nos dois kinds (ex.: 'CANCELADO'); por isso
// consultamos por (service_type_id, slug) e devolvemos os kinds encontrados.
async function stageKindsForSlug(
  serviceTypeId: string,
  stageSlug: string,
): Promise<Set<"op" | "fin">> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_pipeline_stages")
    .select("kind")
    .eq("service_type_id", serviceTypeId)
    .eq("slug", stageSlug)
    .is("deleted_at", null);
  return new Set((data ?? []).map((r) => r.kind as "op" | "fin"));
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
    .select("id, case_id, stage_slug, def_id, required, label, organization_id")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();
  if (iErr || !item) throw new ChecklistServiceError("Item de checklist não encontrado", 404);

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, macrostatus_op, macrostatus_fin, service_type_id, organization_id")
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

  // Descobre a que esteira(s) a etapa do item pertence (op e/ou fin). Um slug
  // pode existir nos dois kinds; disparamos o gate correspondente a cada um.
  const kinds = caso.service_type_id
    ? await stageKindsForSlug(caso.service_type_id, item.stage_slug)
    : new Set<"op" | "fin">();

  if (done) {
    // done=true → tenta avançar (o gate só promove a partir da etapa esperada;
    // se o card já foi movido à frente por DnD, a guarda não casa → no-op).
    // Roteia para op e/ou fin conforme o kind da etapa do item.
    if (kinds.size === 0 || kinds.has("op")) await avancarSeChecklistOk(item.case_id, userId);
    if (kinds.has("fin")) await avancarFinSeOk(item.case_id, userId);
    return updated;
  }

  // done=false → checar se o item é required de uma etapa JÁ ULTRAPASSADA (S2-05).
  // Avalia por esteira: op contra macrostatus_op, fin contra macrostatus_fin.
  const checks: { kind: "op" | "fin"; current: string | null | undefined }[] = [];
  if (kinds.has("op") || kinds.size === 0)
    checks.push({ kind: "op", current: caso.macrostatus_op });
  if (kinds.has("fin")) checks.push({ kind: "fin", current: caso.macrostatus_fin });

  for (const { kind, current } of checks) {
    if (!caso.service_type_id || !current || item.stage_slug === current) continue;
    // ordem da etapa do item e da etapa atual do caso (na esteira certa).
    const { data: stages } = await sb
      .from("system_pipeline_stages")
      .select("slug, ordem")
      .eq("service_type_id", caso.service_type_id)
      .eq("kind", kind)
      .in("slug", [item.stage_slug, current])
      .is("deleted_at", null);
    const itemOrdem = stages?.find((s) => s.slug === item.stage_slug)?.ordem;
    const currentOrdem = stages?.find((s) => s.slug === current)?.ordem;

    // etapa do item é anterior à atual → ultrapassada.
    if (itemOrdem !== undefined && currentOrdem !== undefined && itemOrdem < currentOrdem) {
      // required + rótulo: itens do modelo vêm do def; itens ad-hoc (def_id NULL)
      // carregam a própria definição na linha (S9-11).
      let isRequired = false;
      let itemKey: string | null = null;
      if (item.def_id != null) {
        const { data: def } = await sb
          .from("system_stage_checklist_defs")
          .select("required, key")
          .eq("id", item.def_id)
          .single();
        isRequired = !!def?.required;
        itemKey = def?.key ?? null;
      } else {
        isRequired = !!item.required;
        itemKey = item.label ?? null;
      }
      if (isRequired) {
        // NÃO regride; grava alerta/evento de inconsistência.
        await sb.from("system_case_events").insert({
          case_id: item.case_id,
          organization_id: caso.organization_id,
          action: "checklist_inconsistente",
          diff: {
            def_key: itemKey,
            stage_slug: item.stage_slug,
            etapa_atual: current,
            kind,
          },
          triggered_by: userId ?? null,
        });
      }
      break; // um alerta basta
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
