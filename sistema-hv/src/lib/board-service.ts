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

import { MACRO_OP_LABELS, type MacroOp } from "./cases/constants";
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

// Token curto aleatório para desambiguar slugs INTERNOS. O owner quer LABELS
// duplicados livremente (quantos "teste" quiser) e recriar-após-excluir sem
// colisão. Como a UNIQUE de stages é (service_type_id, kind, slug) — CHEIA
// (ignora deleted_at) — o slug NUNCA pode repetir. Solução: slug interno =
// slugify(label) + token único (o LABEL exibido continua o que o usuário digitou).
function uniqueToken(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
//
// PROBLEMA #4 (owner enfático): "posso gerar quantos duplicados eu quiser com o
// mesmo nome". A UNIQUE de stages é CHEIA (ignora deleted_at) → o slug NÃO pode
// repetir NEM entre ativos NEM contra soft-deletados. Por isso IGNORAMOS o slug
// que a UI mandar e SEMPRE geramos um slug INTERNO ÚNICO (slugify(label)+token).
// O LABEL exibido continua o que o usuário digitou → labels repetem à vontade e
// recriar-após-excluir nunca colide. A coluna dos casos é `stage_slug` (interno),
// então cada etapa carrega sua identidade própria de forma estável.
export async function createBoardStage(input: {
  board_id: string;
  slug?: string;
  label: string;
  stage_role?: string;
  ordem?: number;
}) {
  const sb = getSupabaseAdmin();
  const label = input.label.trim();
  if (!label) throw new BoardServiceError("Nome da etapa obrigatório", 422);

  const { data: board } = await sb
    .from("system_pipeline_boards")
    .select("service_type_id, is_principal")
    .eq("id", input.board_id)
    .is("deleted_at", null)
    .single();
  if (!board) throw new BoardServiceError("Board não encontrado", 404);
  if (board.is_principal) {
    throw new BoardServiceError(
      "As etapas do board principal são as do operacional · edite-as em 'Editar etapas'.",
      409,
    );
  }

  // Slug interno SEMPRE único (independe do que a UI mandou) — libera labels
  // duplicados e recriar-após-excluir sem esbarrar na UNIQUE cheia.
  const baseSlug = slugify(input.slug || label).slice(0, 40);
  const slug = `${baseSlug}_${uniqueToken()}`.slice(0, 64);

  const { data, error } = await sb
    .from("system_pipeline_stages")
    .insert({
      organization_id: DEFAULT_ORG,
      service_type_id: board.service_type_id,
      board_id: input.board_id,
      kind: "op",
      slug,
      label,
      stage_role: input.stage_role ?? "normal",
      ordem: input.ordem ?? 0,
    })
    .select()
    .single();
  if (error || !data) throw new BoardServiceError(error?.message ?? "Falha ao criar etapa", 500);
  return data;
}

// Renomeia/reordena uma etapa de board custom. NÃO altera slug (o slug é a
// identidade da coluna nas posições dos casos). Guarda: a etapa DEVE pertencer a
// um board custom (board_id não-nulo) — jamais toca etapas op/fin legadas.
export async function updateBoardStage(
  id: string,
  patch: Partial<{ label: string; ordem: number; stage_role: string }>,
) {
  const sb = getSupabaseAdmin();
  const { data: stage } = await sb
    .from("system_pipeline_stages")
    .select("id, board_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!stage?.board_id) {
    throw new BoardServiceError(
      "Etapa inválida para board (use o editor de etapas do operacional).",
      409,
    );
  }
  const clean: { label?: string; ordem?: number; stage_role?: string } = {};
  if (patch.label !== undefined) {
    const l = patch.label.trim();
    if (!l) throw new BoardServiceError("Nome da etapa obrigatório", 422);
    clean.label = l;
  }
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;
  if (patch.stage_role !== undefined) clean.stage_role = patch.stage_role;

  const { data, error } = await sb
    .from("system_pipeline_stages")
    .update(clean)
    .eq("id", id)
    .select()
    .single();
  if (error || !data)
    throw new BoardServiceError(error?.message ?? "Falha ao atualizar etapa", 500);
  return data;
}

// Reordena as etapas de um board custom (grava `ordem` = índice). Não valida
// board_id item-a-item (o array vem do editor já escopado ao board).
export async function reorderBoardStages(ids: string[]) {
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb
      .from("system_pipeline_stages")
      .update({ ordem: i })
      .eq("id", ids[i])
      .not("board_id", "is", null);
    if (error) throw new BoardServiceError(error.message, 500);
  }
  return { ok: true as const };
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
    throw new BoardServiceError("Há casos nesta etapa · remaneje antes de excluir.", 409);
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

// Resolve a etapa-ALVO de um board custom: se `stageId` foi informado, valida que
// pertence ao board; senão usa a 1ª etapa (ordem 0). Retorna null se o board não
// tem etapa nenhuma (o caller decide se isso é erro).
async function resolveTargetStage(
  sb: ReturnType<typeof getSupabaseAdmin>,
  boardId: string,
  stageId?: string | null,
): Promise<{ id: string; slug: string } | null> {
  if (stageId) {
    const { data: st } = await sb
      .from("system_pipeline_stages")
      .select("id, slug, board_id")
      .eq("id", stageId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!st || st.board_id !== boardId) {
      throw new BoardServiceError("Etapa inválida para este board.", 422);
    }
    return { id: st.id, slug: st.slug };
  }
  const first = await firstStageOfBoard(sb, boardId);
  return first ? { id: first.id, slug: first.slug } : null;
}

// Adiciona um caso a um board CUSTOM na etapa escolhida (ou na 1ª, se omitida).
// Idempotente por (case, board): se já posicionado, apenas realinha `exclusive`
// e a etapa (quando `stageId` foi passado). Registra evento na timeline.
//
// A4 (2026-08-03) — `exclusive`:
//   • DUPLICAR  → exclusive=false (mantém o caso no principal e nos demais boards).
//   • MOVER     → exclusive=true  (o caso SAI do principal e dos OUTROS boards
//                 custom: sumimos as demais posições — o caso passa a existir SÓ
//                 neste board). O PrincipalKanban filtra por NOT EXISTS(exclusive).
export async function addCaseToBoard(
  caseId: string,
  boardId: string,
  opts?: { exclusive?: boolean; stageId?: string | null; triggeredBy?: string },
) {
  const sb = getSupabaseAdmin();
  const exclusive = opts?.exclusive ?? false;
  const triggeredBy = opts?.triggeredBy;

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

  const target = await resolveTargetStage(sb, boardId, opts?.stageId);
  // MOVER (exclusive) exige uma etapa de destino — o board precisa ter ao menos 1.
  if (exclusive && !target) {
    throw new BoardServiceError(
      "Crie uma etapa no kanban escolhido antes de mover/duplicar o caso.",
      422,
    );
  }

  // Se MOVER exclusivo: remove as posições em OUTROS boards custom (o caso passa
  // a existir só neste board). Faz ANTES do upsert deste board.
  if (exclusive) {
    await sb
      .from("system_case_board_positions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("case_id", caseId)
      .is("deleted_at", null)
      .neq("board_id", boardId);
  }

  // Idempotente: já posicionado neste board → realinha exclusive + etapa (se dada).
  const { data: existing } = await sb
    .from("system_case_board_positions")
    .select("id")
    .eq("case_id", caseId)
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    const patch: {
      exclusive: boolean;
      stage_id?: string;
      stage_slug?: string;
      entered_at?: string;
    } = { exclusive };
    if (target) {
      patch.stage_id = target.id;
      patch.stage_slug = target.slug;
      patch.entered_at = new Date().toISOString();
    }
    await sb.from("system_case_board_positions").update(patch).eq("id", existing.id);
    return { ok: true as const, noop: true, id: existing.id };
  }

  const { data, error } = await sb
    .from("system_case_board_positions")
    .insert({
      organization_id: caso.organization_id,
      case_id: caseId,
      board_id: boardId,
      stage_id: target?.id ?? null,
      stage_slug: target?.slug ?? null,
      entered_at: new Date().toISOString(),
      exclusive,
    })
    .select()
    .single();
  if (error || !data)
    throw new BoardServiceError(error?.message ?? "Falha ao adicionar ao board", 500);

  // Timeline (A6) — evento board_added (mover exclusivo x duplicar aditivo).
  await sb
    .from("system_case_events")
    .insert({
      case_id: caseId,
      organization_id: caso.organization_id,
      action: exclusive ? "board_moved_exclusive" : "board_added",
      diff: {
        board_id: boardId,
        board_label: board.label,
        stage_slug: target?.slug ?? null,
        exclusive,
      },
      triggered_by: triggeredBy ?? null,
    })
    .then(
      () => {},
      () => {},
    );

  return { ok: true as const, noop: false, id: data.id };
}

// AJUSTE #2 (item 5) — lista os boards CUSTOM em que o caso já está posicionado
// (via system_case_board_positions). O board PRINCIPAL não entra: ele espelha
// TODO caso (posição virtual), então "o caso já está no principal" é implícito.
// Usado pelo diálogo Mover/Duplicar para excluir do seletor os boards de destino
// onde o caso já se encontra.
export async function listCaseBoards(caseId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_board_positions_active")
    .select("board_id")
    .eq("case_id", caseId);
  if (error) throw new BoardServiceError(error.message, 500);
  return (data ?? []).map((p) => p.board_id as string);
}

// C3 (Reunião 2026-08-05) — RASTRO OPERACIONAL agregado (multi-kanban). Devolve,
// para UM caso, a lista de posições operacionais em TODOS os kanbans em que ele
// está: (a) o board PRINCIPAL (virtual, derivado de macrostatus_op) SEMPRE em 1º;
// (b) uma entrada por board CUSTOM ativo (system_case_board_positions_active), com
// label do board e label da etapa (casado de stage_slug → stages.label). READ-ONLY
// puro: jamais escreve, jamais toca o trigger/system_cases. As posições usam as
// views _active, então boards/etapas soft-deletados não aparecem (AC-7).
export type CaseOperationalTrailEntry = {
  board_id: string | null; // null = principal (virtual, sem linha física)
  board_label: string;
  is_principal: boolean;
  stage_slug: string | null;
  stage_label: string;
  entered_at: string | null;
};

export async function listCaseOperationalTrail(
  caseId: string,
): Promise<CaseOperationalTrailEntry[]> {
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, service_type_id, macrostatus_op, status_changed_at")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!caso) throw new BoardServiceError("Caso não encontrado", 404);

  const entries: CaseOperationalTrailEntry[] = [];

  // (a) Linha do PRINCIPAL. Label do board = board principal do tema (se houver);
  // rótulo da etapa op = MACRO_OP_LABELS[macrostatus_op] (fallback: valor cru).
  const boards = caso.service_type_id ? await listBoards(caso.service_type_id) : [];
  const principal = boards.find((b) => b.is_principal);
  const macroOp = caso.macrostatus_op as string | null;
  entries.push({
    board_id: null,
    board_label: principal?.label ?? "Principal",
    is_principal: true,
    stage_slug: macroOp,
    stage_label: macroOp ? (MACRO_OP_LABELS[macroOp as MacroOp] ?? macroOp) : "·",
    entered_at: caso.status_changed_at ?? null,
  });

  // (b) Boards CUSTOM em que o caso tem posição ativa. Casa stage_slug → label da
  // etapa do board (system_pipeline_stages_active). Ordena pela `ordem` do board.
  const { data: positions, error: posErr } = await sb
    .from("system_case_board_positions_active")
    .select("board_id, stage_slug, entered_at")
    .eq("case_id", caseId);
  if (posErr) throw new BoardServiceError(posErr.message, 500);

  const custom = (positions ?? []).filter((p) => p.board_id);
  if (custom.length > 0) {
    // Mapa board_id → board ativo (label/ordem). Só boards do tema entram (os que
    // vieram de listBoards); posições de boards de outro tema são ignoradas.
    const boardById = new Map(boards.map((b) => [b.id as string, b]));

    // Rótulos das etapas: uma leitura das etapas ativas dos boards envolvidos,
    // casando (board_id, slug) → label. Evita N+1.
    const boardIds = Array.from(new Set(custom.map((p) => p.board_id as string)));
    const { data: stages } = await sb
      .from("system_pipeline_stages_active")
      .select("board_id, slug, label")
      .in("board_id", boardIds);
    const stageLabel = new Map<string, string>();
    for (const s of stages ?? []) {
      stageLabel.set(`${s.board_id}::${s.slug}`, s.label as string);
    }

    const customEntries: (CaseOperationalTrailEntry & { ordem: number })[] = [];
    for (const p of custom) {
      const board = boardById.get(p.board_id as string);
      if (!board) continue; // board de outro tema / soft-deletado → fora.
      const slug = p.stage_slug as string | null;
      customEntries.push({
        board_id: p.board_id as string,
        board_label: board.label as string,
        is_principal: false,
        stage_slug: slug,
        stage_label: slug ? (stageLabel.get(`${p.board_id}::${slug}`) ?? "·") : "·",
        entered_at: (p.entered_at as string | null) ?? null,
        ordem: (board.ordem as number) ?? 0,
      });
    }
    customEntries.sort((a, b) => a.ordem - b.ordem);
    for (const e of customEntries) {
      const { ordem: _ordem, ...rest } = e;
      void _ordem;
      entries.push(rest);
    }
  }

  return entries;
}

// A4 — indica se o caso tem ALGUMA posição custom exclusiva ativa (foi MOVIDO
// para fora do principal). Usado pelo diálogo para saber se "voltar ao principal"
// tem efeito real.
export async function caseHasExclusivePosition(caseId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_case_board_positions_active")
    .select("id")
    .eq("case_id", caseId)
    .eq("exclusive", true)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// AJUSTE #2 (item 5) — remove o caso de um board CUSTOM (soft-delete da posição).
// Idempotente (não posicionado → no-op). Nunca aplica ao principal (não há
// posição física dele). Evento de timeline 'board_removed'.
export async function removeCaseFromBoard(caseId: string, boardId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { data: board } = await sb
    .from("system_pipeline_boards")
    .select("id, label, is_principal")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();
  if (!board) throw new BoardServiceError("Board não encontrado", 404);
  if (board.is_principal) {
    throw new BoardServiceError("O caso não pode sair do board principal.", 409);
  }

  const { data: pos } = await sb
    .from("system_case_board_positions")
    .select("id, organization_id")
    .eq("case_id", caseId)
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!pos) return { ok: true as const, noop: true };

  const { error } = await sb
    .from("system_case_board_positions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pos.id);
  if (error) throw new BoardServiceError(error.message, 500);

  await sb
    .from("system_case_events")
    .insert({
      case_id: caseId,
      organization_id: pos.organization_id,
      action: "board_removed",
      diff: { board_id: boardId, board_label: board.label },
      triggered_by: triggeredBy ?? null,
    })
    .then(
      () => {},
      () => {},
    );

  return { ok: true as const, noop: false };
}

// A4 (2026-08-03) — "voltar ao principal" (Mais Médicos): remove TODAS as posições
// custom do caso (soft-delete), fazendo-o reaparecer no PrincipalKanban (que
// filtra por NOT EXISTS de posição exclusiva). Idempotente (sem posições → no-op).
// Evento de timeline 'board_returned_to_principal'.
export async function returnCaseToPrincipal(caseId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new BoardServiceError("Caso não encontrado", 404);

  const { data: positions } = await sb
    .from("system_case_board_positions")
    .select("id")
    .eq("case_id", caseId)
    .is("deleted_at", null);
  if (!positions || positions.length === 0) {
    return { ok: true as const, noop: true, removed: 0 };
  }

  await sb
    .from("system_case_board_positions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("case_id", caseId)
    .is("deleted_at", null);

  await sb
    .from("system_case_events")
    .insert({
      case_id: caseId,
      organization_id: caso.organization_id,
      action: "board_returned_to_principal",
      diff: { removed_positions: positions.length },
      triggered_by: triggeredBy ?? null,
    })
    .then(
      () => {},
      () => {},
    );

  return { ok: true as const, noop: false, removed: positions.length };
}

// AJUSTE #2 (item 5) + A4 — MOVER/DUPLICAR o caso entre kanbans.
//   • toBoard = PRINCIPAL  → "voltar ao principal": remove todas as posições
//     custom (returnCaseToPrincipal). MOVER e DUPLICAR caem no mesmo efeito (o
//     caso volta ao fluxo principal; duplicar-no-principal não faz sentido).
//   • toBoard = CUSTOM, exclusive=true (MOVER) → o caso vai SÓ para o destino na
//     etapa escolhida; sai do principal e dos demais boards custom.
//   • toBoard = CUSTOM, exclusive=false (DUPLICAR) → adiciona no destino sem mexer
//     nas outras posições (segue no principal e onde já estava).
// NÃO altera tema_id/service_type_id.
export async function moveCaseBetweenBoards(
  caseId: string,
  toBoardId: string,
  opts?: { exclusive?: boolean; stageId?: string | null; triggeredBy?: string },
) {
  const sb = getSupabaseAdmin();
  const { data: toBoard } = await sb
    .from("system_pipeline_boards")
    .select("id, is_principal")
    .eq("id", toBoardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!toBoard) throw new BoardServiceError("Board de destino não encontrado", 404);

  // Destino = principal → voltar ao principal (limpa posições custom).
  if (toBoard.is_principal) {
    return returnCaseToPrincipal(caseId, opts?.triggeredBy);
  }

  // Destino custom → addCaseToBoard cuida do exclusive (mover) x aditivo (duplicar):
  // no exclusive ele já remove as posições dos outros boards custom.
  return addCaseToBoard(caseId, toBoardId, {
    exclusive: opts?.exclusive ?? false,
    stageId: opts?.stageId ?? null,
    triggeredBy: opts?.triggeredBy,
  });
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
    throw new BoardServiceError("Caso não está neste board · adicione-o primeiro.", 404);
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

// TAREFA B (2026-08-04) — só os IDS dos casos com posição ATIVA num board custom.
// Leve (não faz join nem carrega os casos): usado pela LISTA para filtrar
// client-side quando o usuário escolhe um kanban específico. NÃO aplica RBAC aqui
// (a Lista já filtra por visibilidade via useCasesList — a interseção resolve).
export async function caseIdsByBoard(boardId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_board_positions_active")
    .select("case_id")
    .eq("board_id", boardId);
  if (error) throw new BoardServiceError(error.message, 500);
  return (data ?? []).map((p) => p.case_id as string);
}

// TAREFA B — IDs dos casos que foram MOVIDOS exclusivamente para algum board custom
// (posição exclusive=true ativa). A Lista usa isto para o filtro do kanban
// PRINCIPAL: o principal mostra os casos do tema que NÃO estão exclusivos em custom
// (mesma regra do PrincipalKanban). Sem filtro por service_type na tabela de
// posições, retornamos TODOS os exclusivos — a Lista já restringe por tema_id.
export async function exclusiveCaseIds(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_board_positions_active")
    .select("case_id")
    .eq("exclusive", true);
  if (error) throw new BoardServiceError(error.message, 500);
  return (data ?? []).map((p) => p.case_id as string);
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
