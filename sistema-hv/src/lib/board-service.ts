// Server-only — A3 (Reunião 2026-08-03): Múltiplos Kanbans (boards/listas) por
// TEMA. Um tema (service_type interno) tem N boards NOMEÁVEIS: 1 PRINCIPAL
// (espelho do operacional) + N boards CUSTOM (sub-fluxos, ex.: "cobrança de
// documento" 1x→2x→3x→4x). Campos/filtros são do TEMA (iguais em todos os
// boards) — este serviço JAMAIS define campo/filtro por board.
//
// MODELAGEM (Opção A da story A3, TRAVADA):
//   - system_pipeline_boards        : boards por service_type.
//   - system_pipeline_stages.board_id: etapas de board custom (NULL = op/fin legado).
//   - system_case_board_positions   : posição do caso em cada board CUSTOM.
//
// O board PRINCIPAL é o ESPELHO VIRTUAL do operacional: suas colunas são as
// etapas op existentes (board_id=NULL, kind='op') e a posição do caso vem de
// macrostatus_op — NÃO usa system_case_board_positions, NÃO toca o trigger, NÃO
// toca system_cases. Regressão ZERO para op/fin.

import { getSupabaseAdmin } from "./supabase/server";
import { getVisibleCaseIds } from "./visibility";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class BoardServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BoardServiceError";
  }
}

// Deriva um slug estável a partir do label (molde do cadastro de tema/categoria).
function slugify(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || `board_${Date.now().toString(36)}`
  );
}

// AJUSTE #2 — garante que o tema (service_type) tenha o board PRINCIPAL. A
// migration semeou 1 principal por service_type existente; para temas CRIADOS
// DEPOIS (createTema) garantimos aqui, on-demand, na 1ª leitura dos boards. O
// principal é o espelho virtual do operacional (não cria etapas). Idempotente:
// o índice único parcial uq_system_pipeline_boards_principal impede duplicar; em
// caso de corrida ignoramos o erro e relemos. Ignora o funil sentinela global.
const GLOBAL_FUNNEL_SERVICE_TYPE_ID = "00000000-0000-0000-0000-0000000000f0";

async function ensurePrincipalBoard(
  sb: ReturnType<typeof getSupabaseAdmin>,
  serviceTypeId: string,
): Promise<void> {
  if (serviceTypeId === GLOBAL_FUNNEL_SERVICE_TYPE_ID) return;

  const { data: existing } = await sb
    .from("system_pipeline_boards")
    .select("id")
    .eq("service_type_id", serviceTypeId)
    .eq("is_principal", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return;

  const { data: st } = await sb
    .from("system_service_types")
    .select("id, name, organization_id")
    .eq("id", serviceTypeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!st) return; // service_type inexistente/excluído — nada a semear.

  await sb
    .from("system_pipeline_boards")
    .insert({
      organization_id: st.organization_id ?? DEFAULT_ORG,
      service_type_id: serviceTypeId,
      slug: "principal",
      label: st.name ?? "Principal",
      ordem: 0,
      is_principal: true,
    })
    // Corrida (outro request semeou primeiro): o índice único parcial rejeita;
    // ignoramos e seguimos — a releitura em listBoards já traz o principal.
    .then(
      () => {},
      () => {},
    );
}

// --------------------------------------------------------------------- Boards
export async function listBoards(serviceTypeId: string) {
  const sb = getSupabaseAdmin();
  // Garante o board principal para temas criados após a migration de seed.
  await ensurePrincipalBoard(sb, serviceTypeId);
  const { data, error } = await sb
    .from("system_pipeline_boards_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .eq("active", true)
    .order("ordem", { ascending: true });
  if (error) throw new BoardServiceError(error.message, 500);
  return data ?? [];
}

export async function createBoard(input: {
  service_type_id: string;
  label: string;
  ordem?: number;
}) {
  const sb = getSupabaseAdmin();
  const label = input.label.trim();
  if (!label) throw new BoardServiceError("Nome do board obrigatório", 422);

  // slug único por tema — se já existir (entre os ativos), sufixa.
  let slug = slugify(label);
  const { data: existing } = await sb
    .from("system_pipeline_boards_active")
    .select("slug")
    .eq("service_type_id", input.service_type_id);
  const taken = new Set((existing ?? []).map((b) => b.slug));
  if (taken.has(slug)) slug = `${slug}_${Date.now().toString(36)}`;

  // ordem default = fim da lista.
  let ordem = input.ordem;
  if (ordem === undefined) {
    ordem = (existing ?? []).length;
  }

  const { data, error } = await sb
    .from("system_pipeline_boards")
    .insert({
      organization_id: DEFAULT_ORG,
      service_type_id: input.service_type_id,
      slug,
      label,
      ordem,
      is_principal: false, // boards criados pela UI são sempre CUSTOM.
    })
    .select()
    .single();
  if (error || !data) throw new BoardServiceError(error?.message ?? "Falha ao criar board", 500);
  return data;
}

// Renomeia/reordena/ativa um board. NÃO altera is_principal nem slug.
export async function updateBoard(
  id: string,
  patch: Partial<{ label: string; ordem: number; active: boolean }>,
) {
  const sb = getSupabaseAdmin();
  const clean: { label?: string; ordem?: number; active?: boolean } = {};
  if (patch.label !== undefined) {
    const l = patch.label.trim();
    if (!l) throw new BoardServiceError("Nome do board obrigatório", 422);
    clean.label = l;
  }
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;
  if (patch.active !== undefined) clean.active = patch.active;

  const { data, error } = await sb
    .from("system_pipeline_boards")
    .update(clean)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new BoardServiceError(error?.message ?? "Falha ao atualizar board", 500);
  return data;
}

export async function reorderBoards(ids: string[]) {
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb.from("system_pipeline_boards").update({ ordem: i }).eq("id", ids[i]);
    if (error) throw new BoardServiceError(error.message, 500);
  }
  return { ok: true as const };
}

// Soft-delete de um board CUSTOM. Guardas: (a) nunca o board principal;
// (b) não excluir com casos posicionados nele. Cascata: soft-delete das etapas
// do board. Tombstone do slug (libera o nome).
export async function softDeleteBoard(id: string) {
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: board } = await sb
    .from("system_pipeline_boards")
    .select("id, slug, is_principal")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!board) throw new BoardServiceError("Board não encontrado", 404);
  if (board.is_principal) {
    throw new BoardServiceError("O board principal não pode ser excluído.", 409);
  }

  const { count } = await sb
    .from("system_case_board_positions")
    .select("id", { count: "exact", head: true })
    .eq("board_id", id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new BoardServiceError(
      "Não é possível excluir: há casos posicionados neste board. Remaneje-os antes.",
      409,
    );
  }

  await sb.from("system_pipeline_stages").update({ deleted_at: nowIso }).eq("board_id", id);
  await sb
    .from("system_pipeline_boards")
    .update({
      deleted_at: nowIso,
      active: false,
      slug: `${board.slug}__del_${Date.now().toString(36)}`,
    })
    .eq("id", id);

  await sb
    .from("system_audit_log")
    .insert({
      organization_id: DEFAULT_ORG,
      action: "board.deleted",
      entity_type: "pipeline_board",
      entity_id: id,
    })
    .then(
      () => {},
      () => {},
    );

  return { ok: true as const, id };
}

// ------------------------------------------------------- Etapas por board custom
export async function listStagesByBoard(boardId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_pipeline_stages_active")
    .select("*")
    .eq("board_id", boardId)
    .order("ordem", { ascending: true });
  if (error) throw new BoardServiceError(error.message, 500);
  return data ?? [];
}

// Cria uma etapa de um board CUSTOM. Carrega o service_type_id do board para
// preencher a FK (a UNIQUE de stages é (service_type_id, kind, slug) — usamos
// kind='op' para as etapas de board custom, num namespace de slug próprio).
export async function createBoardStage(input: {
  board_id: string;
  slug: string;
  label: string;
  stage_role?: string;
  ordem?: number;
}) {
  const sb = getSupabaseAdmin();
  const { data: board } = await sb
    .from("system_pipeline_boards")
    .select("service_type_id, is_principal")
    .eq("id", input.board_id)
    .is("deleted_at", null)
    .single();
  if (!board) throw new BoardServiceError("Board não encontrado", 404);
  if (board.is_principal) {
    throw new BoardServiceError(
      "As etapas do board principal são as do operacional — edite-as em 'Editar etapas'.",
      409,
    );
  }

  const { data, error } = await sb
    .from("system_pipeline_stages")
    .insert({
      organization_id: DEFAULT_ORG,
      service_type_id: board.service_type_id,
      board_id: input.board_id,
      kind: "op",
      slug: input.slug,
      label: input.label,
      stage_role: input.stage_role ?? "normal",
      ordem: input.ordem ?? 0,
    })
    .select()
    .single();
  if (error || !data) throw new BoardServiceError(error?.message ?? "Falha ao criar etapa", 500);
  return data;
}

// Soft-delete de uma etapa de board custom. Guarda: nenhum caso posicionado nela.
export async function softDeleteBoardStage(id: string) {
  const sb = getSupabaseAdmin();
  const { data: stage } = await sb
    .from("system_pipeline_stages")
    .select("id, board_id")
    .eq("id", id)
    .single();
  if (!stage?.board_id) {
    throw new BoardServiceError(
      "Etapa inválida para board (use o editor de etapas do operacional).",
      409,
    );
  }
  const { count } = await sb
    .from("system_case_board_positions")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new BoardServiceError("Há casos nesta etapa — remaneje antes de excluir.", 409);
  }
  const { error } = await sb
    .from("system_pipeline_stages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new BoardServiceError(error.message, 500);
  return { ok: true as const, id };
}

// --------------------------------------------------------- Posição do caso
// Carrega a etapa (ordem 0) de um board custom, garantindo que pertence ao board.
async function firstStageOfBoard(sb: ReturnType<typeof getSupabaseAdmin>, boardId: string) {
  const { data } = await sb
    .from("system_pipeline_stages_active")
    .select("id, slug")
    .eq("board_id", boardId)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// Adiciona um caso a um board CUSTOM na 1ª etapa. Idempotente (já posicionado →
// no-op). Registra evento na timeline (system_case_events, action 'board_added').
export async function addCaseToBoard(caseId: string, boardId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new BoardServiceError("Caso não encontrado", 404);

  const { data: board } = await sb
    .from("system_pipeline_boards")
    .select("id, label, is_principal")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();
  if (!board) throw new BoardServiceError("Board não encontrado", 404);
  if (board.is_principal) {
    throw new BoardServiceError("Todo caso já está no board principal.", 409);
  }

  // Idempotente: já posicionado neste board → no-op.
  const { data: existing } = await sb
    .from("system_case_board_positions")
    .select("id")
    .eq("case_id", caseId)
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return { ok: true as const, noop: true, id: existing.id };

  const first = await firstStageOfBoard(sb, boardId);
  const { data, error } = await sb
    .from("system_case_board_positions")
    .insert({
      organization_id: caso.organization_id,
      case_id: caseId,
      board_id: boardId,
      stage_id: first?.id ?? null,
      stage_slug: first?.slug ?? null,
      entered_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error || !data)
    throw new BoardServiceError(error?.message ?? "Falha ao adicionar ao board", 500);

  // Timeline (A6) — evento board_added.
  await sb
    .from("system_case_events")
    .insert({
      case_id: caseId,
      organization_id: caso.organization_id,
      action: "board_added",
      diff: { board_id: boardId, board_label: board.label, stage_slug: first?.slug ?? null },
      triggered_by: triggeredBy ?? null,
    })
    .then(
      () => {},
      () => {},
    );

  return { ok: true as const, noop: false, id: data.id };
}

// Move o caso entre etapas DENTRO de um board custom (upsert da posição). A etapa
// destino deve pertencer ao board. Idempotente. Evento 'board_stage_changed'.
export async function moveCaseInBoard(
  caseId: string,
  boardId: string,
  stageId: string,
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();

  const { data: stage } = await sb
    .from("system_pipeline_stages")
    .select("id, slug, board_id")
    .eq("id", stageId)
    .is("deleted_at", null)
    .single();
  if (!stage || stage.board_id !== boardId) {
    throw new BoardServiceError("Etapa inválida para este board.", 422);
  }

  const { data: pos } = await sb
    .from("system_case_board_positions")
    .select("id, organization_id, stage_slug")
    .eq("case_id", caseId)
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!pos) {
    throw new BoardServiceError("Caso não está neste board — adicione-o primeiro.", 404);
  }

  const from = pos.stage_slug ?? null;
  if (from === stage.slug) {
    return { ok: true as const, noop: true, id: pos.id, stage_slug: from };
  }

  const { data, error } = await sb
    .from("system_case_board_positions")
    .update({
      stage_id: stage.id,
      stage_slug: stage.slug,
      entered_at: new Date().toISOString(),
    })
    .eq("id", pos.id)
    .select()
    .single();
  if (error || !data) throw new BoardServiceError(error?.message ?? "Falha ao mover", 500);

  await sb
    .from("system_case_events")
    .insert({
      case_id: caseId,
      organization_id: pos.organization_id,
      action: "board_stage_changed",
      diff: { board_id: boardId, from, to: stage.slug },
      triggered_by: triggeredBy ?? null,
    })
    .then(
      () => {},
      () => {},
    );

  return { ok: true as const, noop: false, id: data.id, stage_slug: stage.slug };
}

// Lista os casos posicionados num board CUSTOM (join posições × casos ativos),
// respeitando a visibilidade (RBAC — advogado vê só os dele). Retorna o caso
// enriquecido com `board_stage_slug` (a coluna do board, usada pelo Kanban).
export async function listCasesByBoard(boardId: string, viewerUserId?: string) {
  const sb = getSupabaseAdmin();
  const visible = await getVisibleCaseIds(viewerUserId);
  if (visible !== null && visible.length === 0) return [];

  const { data: positions, error } = await sb
    .from("system_case_board_positions_active")
    .select("case_id, stage_slug, entered_at")
    .eq("board_id", boardId);
  if (error) throw new BoardServiceError(error.message, 500);
  if (!positions || positions.length === 0) return [];

  const slugByCase = new Map<string, string | null>();
  const enteredByCase = new Map<string, string>();
  for (const p of positions) {
    slugByCase.set(p.case_id, p.stage_slug);
    enteredByCase.set(p.case_id, p.entered_at);
  }
  let ids = Array.from(slugByCase.keys());
  if (visible !== null) {
    const vis = new Set(visible);
    ids = ids.filter((id) => vis.has(id));
  }
  if (ids.length === 0) return [];

  const { data: cases, error: cErr } = await sb
    .from("system_cases_active")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (cErr) throw new BoardServiceError(cErr.message, 500);

  return (cases ?? []).map((c) => ({
    ...c,
    board_stage_slug: slugByCase.get(c.id) ?? null,
    board_entered_at: enteredByCase.get(c.id) ?? null,
  }));
}
