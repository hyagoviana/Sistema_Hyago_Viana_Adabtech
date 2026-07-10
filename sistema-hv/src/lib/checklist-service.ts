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
  assigned_to?: string | null;
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
      assigned_to: input.assigned_to ?? null,
    } as never)
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
    assigned_to: string | null;
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
  if (patch.assigned_to !== undefined) clean.assigned_to = patch.assigned_to;

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

// Soft-delete do DEF + PROPAGA para as instâncias já criadas nos casos. Ao
// excluir uma etapa fixa no editor de funil, ela some de TODOS os cards que a
// herdaram (soft-delete = reversível). Antes as instâncias ficavam órfãs e
// continuavam aparecendo no checklist do caso (bug 2026-07-09).
export async function softDeleteChecklistDef(id: string) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await sb
    .from("system_stage_checklist_defs")
    .update({ deleted_at: now, active: false })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new ChecklistServiceError(error.message, 500);

  // Propaga a exclusão para as instâncias herdadas desta def em todos os casos.
  const { error: itErr } = await sb
    .from("system_case_checklist_items")
    .update({ deleted_at: now })
    .eq("def_id", id)
    .is("deleted_at", null);
  if (itErr) throw new ChecklistServiceError(itErr.message, 500);

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

  // (2026-07-09) Reconciliação idempotente ANTES de ler: garante que TODA def da(s)
  // etapa(s) ATUAL(is) do caso (operacional + financeira) tenha uma instância. Sem
  // isso, uma etapa de checklist criada no editor de funil DEPOIS que o caso já
  // estava na etapa nunca aparecia (a instanciação só rodava ao ENTRAR na etapa).
  // A fn usa ON CONFLICT DO NOTHING → não duplica instâncias já existentes.
  const { data: caso } = await sb
    .from("system_cases")
    .select("macrostatus_op, macrostatus_fin, service_type_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (caso?.service_type_id) {
    const stages = [caso.macrostatus_op, caso.macrostatus_fin].filter(
      (s): s is string => !!s && s !== "NAO_APLICAVEL",
    );
    for (const slug of [...new Set(stages)]) {
      const { error: rErr } = await sb.rpc("system_fn_instanciar_checklist", {
        p_case_id: caseId,
        p_stage_slug: slug,
      });
      // Falha na reconciliação não deve derrubar a leitura do checklist.
      if (rErr) console.error("reconciliar checklist:", rErr.message);
    }
  }

  const { data, error } = await sb
    .from("system_case_checklist_items")
    .select(
      "*, def:system_stage_checklist_defs(key, label, ordem, required, expected_doc_pattern, deleted_at)",
    )
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("stage_slug")
    .order("created_at");
  if (error) throw new ChecklistServiceError(error.message, 500);

  // Guarda de leitura: item HERDADO (def_id != null) cuja DEF foi excluída no
  // editor de funil NÃO deve aparecer, mesmo que a instância ainda não tenha sido
  // propagada (defesa em profundidade junto ao soft-delete em softDeleteChecklistDef).
  const visible = (data ?? []).filter((row) => {
    const r = row as { def_id: string | null; def?: { deleted_at?: string | null } | null };
    return !(r.def_id != null && r.def?.deleted_at);
  });

  // (2b, 2026-07-10) Responsáveis MÚLTIPLOS por item (N:N) — une com o assigned_to
  // primário. `assignee_ids` alimenta o seletor multi na UI.
  const itemIds = visible.map((r) => (r as { id: string }).id);
  const assigneeMap = new Map<string, Set<string>>();
  if (itemIds.length) {
    const { data: links } = await sb
      .from("system_case_checklist_item_assignees")
      .select("item_id, user_id")
      .in("item_id", itemIds);
    for (const l of links ?? []) {
      const row = l as { item_id: string; user_id: string };
      const set = assigneeMap.get(row.item_id) ?? new Set<string>();
      set.add(row.user_id);
      assigneeMap.set(row.item_id, set);
    }
  }

  // Normaliza itens AD-HOC (S9-11): quando def_id IS NULL, o item carrega a
  // própria definição (label/required/ordem). Projetamos num `def` sintético para
  // a UI consumir com a mesma forma dos itens herdados do modelo, e marcamos
  // is_adhoc p/ diferenciar visualmente e liberar editar/excluir por caso.
  return visible.map((row) => {
    const r = row as typeof row & {
      id: string;
      def_id: string | null;
      label: string | null;
      required: boolean;
      ordem: number;
      assigned_to: string | null;
    };
    const set = assigneeMap.get(r.id) ?? new Set<string>();
    if (r.assigned_to) set.add(r.assigned_to);
    const assignee_ids = [...set];
    const isAdhoc = r.def_id == null;
    if (isAdhoc) {
      return {
        ...r,
        assignee_ids,
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
    return { ...r, assignee_ids, is_adhoc: false as const };
  });
}

// ----------------------------------------------------------------------------
// ITENS AD-HOC POR CASO (S9-11) — critérios EXTRAS que valem SÓ p/ este caso.
//   - def_id IS NULL; a definição (label/required/ordem) vive no próprio item.
//   - herdados do modelo (def_id NOT NULL) continuam vindo do editor de funil e
//     NÃO são editáveis por caso (só marcáveis). Ad-hoc pode criar/editar/excluir.
//   - o gate (op/fin) já considera required ad-hoc (migration 20260709000001),
//     MAS o avanço do funil só é disparado ao MARCAR um item como concluído
//     (marcarItemChecklist). Criar/editar/excluir uma etapa NÃO avança o caso —
//     senão excluir um item pendente "pulava" o funil sozinho (bug 2026-07-09).
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

// (2026-07-09, item 3) — vincula/desvincula o RESPONSÁVEL (usuário do sistema) de
// um item de checklist. Ao vincular, o caso passa a ser visível para o usuário
// (ver getVisibleCaseIds). null = remove o responsável.
export async function setChecklistItemAssignee(itemId: string, assignedTo: string | null) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_checklist_items")
    .update({ assigned_to: assignedTo })
    .eq("id", itemId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new ChecklistServiceError(error?.message ?? "Falha ao vincular responsável", 500);
  return data;
}

// (2b, 2026-07-10) — define o conjunto de responsáveis (MÚLTIPLOS) de um item de
// checklist. Substitui a N:N e mantém assigned_to = primeiro (compat com a
// visibilidade single/leituras). Todos os responsáveis passam a ver o caso.
export async function setChecklistItemAssignees(itemId: string, userIds: string[]) {
  const sb = getSupabaseAdmin();
  const unique = [...new Set((userIds ?? []).filter(Boolean))];

  await sb.from("system_case_checklist_item_assignees").delete().eq("item_id", itemId);
  if (unique.length) {
    const { error: insErr } = await sb
      .from("system_case_checklist_item_assignees")
      .upsert(
        unique.map((uid) => ({ item_id: itemId, user_id: uid })),
        { onConflict: "item_id,user_id" },
      );
    if (insErr) throw new ChecklistServiceError(insErr.message, 500);
  }

  const { error } = await sb
    .from("system_case_checklist_items")
    .update({ assigned_to: unique[0] ?? null })
    .eq("id", itemId)
    .is("deleted_at", null);
  if (error) throw new ChecklistServiceError(error.message, 500);
  return { ok: true as const, itemId, userIds: unique };
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

  // (2026-07-09) — checklist é SÓ do financeiro. Bloqueia criar critério numa
  // etapa que é apenas OPERACIONAL (kind 'op' e não 'fin').
  if (caso.service_type_id) {
    const kinds = await stageKindsForSlug(caso.service_type_id, input.stageSlug);
    if (kinds.has("op") && !kinds.has("fin")) {
      throw new ChecklistServiceError(
        "Checklist existe apenas nas etapas financeiras. Etapas operacionais não têm checklist.",
        422,
      );
    }
  }

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

  // (2026-07-09) — editar/excluir uma etapa NÃO avança o funil. O avanço só ocorre
  // ao MARCAR uma etapa como concluída (marcarItemChecklist). Antes, editar/excluir
  // disparava o gate e "pulava" o caso indevidamente (ex.: voltar manualmente e
  // excluir uma etapa fazia o caso avançar de novo).
  return data;
}

// Soft-delete de um item AD-HOC (def_id IS NULL). NUNCA exclui herdado.
export async function deleteAdhocChecklistItem(itemId: string) {
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

  // (2026-07-09) — excluir uma etapa NÃO avança o funil (só marcar avança).
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
