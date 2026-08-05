// Server-only — Tipos de Serviço + Etapas de pipeline (configuráveis) e
// movimentação de casos por etapa. Dual-write: a UI move por stage, mas
// gravamos macrostatus_* = slug da etapa (o trigger projeta stage_*), mantendo
// a bifurcação atual intacta (ADR-007).

import { countChecklistItemsForStage, instanciarChecklist } from "./checklist-service";
import { GLOBAL_FUNNEL_SERVICE_TYPE_ID } from "./cases/constants";
import { deleteFile } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";
import { getVisibleCaseIds, getVisibleClientIds } from "./visibility";

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

export type StageKind = "op" | "fin" | "comercial";

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
    .insert({
      organization_id: DEFAULT_ORG,
      name: input.name,
      slug: input.slug,
      ordem: input.ordem ?? 0,
    })
    .select()
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao criar tipo", 500);

  // ITEM 6.3 (2026-07-06) — semeia o CONJUNTO COMPLETO de etapas (op + fin +
  // comercial). Os slugs de FIN e COMERCIAL DEVEM espelhar exatamente o funil
  // ÚNICO/sentinela (system_pipeline_stages do GLOBAL_FUNNEL_SERVICE_TYPE_ID),
  // senão o tipo novo NASCE QUEBRADO no funil único: mover um caso desse tipo a
  // uma etapa comercial/fin do board global gravaria macrostatus_* = slug e a
  // projeção system_fn_sync_stage_ids não acharia a etapa per-tipo correspondente.
  // O OPERACIONAL é per-tipo (o sentinela não tem etapas op) — mantemos um conjunto
  // op enxuto e editável pelo dono.
  const defaults = [
    // ── Operacional (per-tipo; editável) ──────────────────────────────────
    { kind: "op", slug: "NOVO", label: "Novo", ordem: 0, stage_role: "normal" },
    { kind: "op", slug: "EM_ANDAMENTO", label: "Em andamento", ordem: 1, stage_role: "normal" },
    { kind: "op", slug: "GANHO", label: "Ganho", ordem: 2, stage_role: "won" },
    { kind: "op", slug: "ENCERRADO", label: "Encerrado", ordem: 3, stage_role: "closed" },
    { kind: "op", slug: "CANCELADO", label: "Cancelado", ordem: 4, stage_role: "lost" },
    // ── Financeiro (espelha o sentinela — conjunto COMPLETO) ───────────────
    { kind: "fin", slug: "ELABORANDO", label: "Elaborando", ordem: 0, stage_role: "normal" },
    { kind: "fin", slug: "APROVACAO", label: "Aprovação", ordem: 1, stage_role: "normal" },
    {
      kind: "fin",
      slug: "AGUARDANDO_ATIVACAO",
      label: "Aguardando ativação",
      ordem: 2,
      stage_role: "normal",
    },
    { kind: "fin", slug: "ATIVO", label: "Ativo", ordem: 3, stage_role: "normal" },
    { kind: "fin", slug: "QUITANDO", label: "Quitando", ordem: 4, stage_role: "normal" },
    { kind: "fin", slug: "QUITADO", label: "Quitado", ordem: 5, stage_role: "closed" },
    { kind: "fin", slug: "INADIMPLENTE", label: "Inadimplente", ordem: 6, stage_role: "normal" },
    { kind: "fin", slug: "PARCIAL", label: "Parcial", ordem: 7, stage_role: "normal" },
    { kind: "fin", slug: "RENEGOCIADO", label: "Renegociado", ordem: 8, stage_role: "normal" },
    { kind: "fin", slug: "SUSPENSO", label: "Suspenso", ordem: 9, stage_role: "normal" },
    { kind: "fin", slug: "CANCELADO", label: "Cancelado", ordem: 10, stage_role: "lost" },
    // ── Comercial (espelha o sentinela — conjunto COMPLETO) ────────────────
    { kind: "comercial", slug: "NOVO", label: "Novo", ordem: 0, stage_role: "normal" },
    { kind: "comercial", slug: "EM_CONTATO", label: "Em contato", ordem: 1, stage_role: "normal" },
    {
      kind: "comercial",
      slug: "PROPOSTA_ENVIADA",
      label: "Proposta enviada",
      ordem: 2,
      stage_role: "normal",
    },
    {
      kind: "comercial",
      slug: "AGUARDANDO_ASSINATURA",
      label: "Aguardando assinatura",
      ordem: 3,
      stage_role: "normal",
    },
    { kind: "comercial", slug: "GANHO", label: "Ganho", ordem: 4, stage_role: "won" },
    { kind: "comercial", slug: "PERDIDO", label: "Perdido", ordem: 5, stage_role: "lost" },
  ];
  await sb
    .from("system_pipeline_stages")
    .insert(
      defaults.map((d) => ({ organization_id: DEFAULT_ORG, service_type_id: data.id, ...d })),
    );

  return data;
}

// Renomeia/edita um Tipo de Serviço (pipeline). Só o DISPLAY (name/ordem/active) —
// o slug PERMANECE imutável, pois é a chave de case_type, das etapas e dos templates.
// Bloqueia o funil único (sentinela) para não renomear o board global por engano.
export async function updateServiceType(
  id: string,
  patch: Partial<{ name: string; ordem: number; active: boolean }>,
) {
  if (id === GLOBAL_FUNNEL_SERVICE_TYPE_ID) {
    throw new PipelineServiceError("O funil único (global) não pode ser renomeado por aqui.", 409);
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_service_types")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new PipelineServiceError(error?.message ?? "Falha ao atualizar tipo", 500);
  return data;
}

// (item 1, 2026-07-09) — EXCLUI uma categoria (tipo de serviço). Só permite se NÃO
// houver casos/clientes vinculados. Em cascata: soft-delete das etapas, dos vínculos
// de pasta e dos modelos daquelas pastas; e MANDA PARA A LIXEIRA no Drive as pastas
// da categoria (que não sejam compartilhadas com outra categoria ativa).
export async function deleteServiceType(id: string) {
  if (id === GLOBAL_FUNNEL_SERVICE_TYPE_ID) {
    throw new PipelineServiceError("O funil único (global) não pode ser excluído.", 409);
  }
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: st } = await sb
    .from("system_service_types")
    .select("slug")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!st) throw new PipelineServiceError("Categoria não encontrada", 404);

  // GUARDA: nenhum caso vinculado (por service_type_id OU case_type=slug).
  const { count } = await sb
    .from("system_cases")
    .select("id", { count: "exact", head: true })
    .or(`service_type_id.eq.${id},case_type.eq.${st.slug}`)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new PipelineServiceError(
      "Não é possível excluir: há casos/clientes vinculados a esta categoria. Remaneje-os antes.",
      409,
    );
  }

  // Pastas vinculadas → trash no Drive (se não compartilhadas) + soft-delete dos modelos.
  const { data: folders } = await sb
    .from("system_service_type_folders_active")
    .select("id, drive_folder_id")
    .eq("service_type_id", id);
  for (const f of folders ?? []) {
    const driveId = (f as { drive_folder_id: string }).drive_folder_id;
    // Modelos daquela pasta saem do sistema.
    await sb
      .from("system_document_templates")
      .update({ deleted_at: nowIso } as never)
      .eq("source_folder_id" as never, driveId as never)
      .is("deleted_at", null);
    // Só manda a pasta pra lixeira se NÃO estiver vinculada a outra categoria ativa.
    const { count: shared } = await sb
      .from("system_service_type_folders_active")
      .select("id", { count: "exact", head: true })
      .eq("drive_folder_id", driveId)
      .neq("service_type_id", id);
    if (!shared) {
      await deleteFile(driveId).catch(() => {});
    }
  }

  // Soft-delete: vínculos de pasta, etapas, modelos por case_type e a própria categoria.
  await sb
    .from("system_service_type_folders")
    .update({ deleted_at: nowIso })
    .eq("service_type_id", id);
  await sb.from("system_pipeline_stages").update({ deleted_at: nowIso }).eq("service_type_id", id);
  await sb
    .from("system_document_templates")
    .update({ deleted_at: nowIso } as never)
    .eq("case_type", st.slug)
    .is("deleted_at", null);
  // Tombstone do slug: a constraint UNIQUE(organization_id, slug) mantém o slug
  // "preso" mesmo após o soft-delete, impedindo recriar uma categoria com o mesmo
  // nome (o slug é derivado do nome no cadastro). Renomeamos o slug da linha
  // excluída para liberar o original — só não pode repetir nome de categoria ATIVA.
  await sb
    .from("system_service_types")
    .update({
      deleted_at: nowIso,
      active: false,
      slug: `${st.slug}__del_${Date.now().toString(36)}`,
    })
    .eq("id", id);

  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "service_type.deleted",
    entity_type: "service_type",
    entity_id: id,
  });

  return { ok: true as const, id };
}

// ------------------------------------------------------------------- Etapas
export async function listStages(serviceTypeId: string, kind: StageKind) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_pipeline_stages_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .eq("kind", kind)
    // Fix A3/#2 — o kanban PRINCIPAL (e o "Editar etapas") só enxerga as etapas
    // DELE (board_id IS NULL). Etapas de kanbans CUSTOM têm board_id setado e são
    // buscadas à parte (listBoardStages); sem este filtro elas vazavam para as
    // colunas do principal.
    .is("board_id", null)
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
  // ITEM 6.2 (2026-07-06) — o funil ÚNICO (sentinela comercial/fin) é COMPARTILHADO
  // por todos os tipos via SLUG. Criar uma etapa SÓ no sentinela geraria uma coluna
  // órfã (nenhum tipo teria a etapa per-slug correspondente, então mover um caso
  // para ela não resolveria stage_*_id). Bloqueamos criar/excluir no sentinela;
  // renomear label/ordem continua permitido (updateStage/reorderStages).
  if (input.service_type_id === GLOBAL_FUNNEL_SERVICE_TYPE_ID) {
    throw new PipelineServiceError(
      "O funil único não permite criar novas etapas (evita coluna órfã). Você pode renomear e reordenar as etapas existentes. Para adicionar etapas, edite o funil por tipo no Operacional.",
      409,
    );
  }
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
  patch: Partial<{
    label: string;
    stage_role: string;
    color: string | null;
    ordem: number;
    active: boolean;
  }>,
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_pipeline_stages")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new PipelineServiceError(error?.message ?? "Falha ao atualizar etapa", 500);
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

  // Carrega a etapa PRIMEIRO — precisamos do service_type_id/slug/kind para a
  // guarda (ITEM 6.1) e para o bloqueio do sentinela (ITEM 6.2).
  const { data: stage } = await sb
    .from("system_pipeline_stages")
    .select("service_type_id, slug, kind")
    .eq("id", id)
    .single();

  // ITEM 6.2 — nunca excluir etapa do funil ÚNICO (sentinela): sumir com a coluna
  // deixaria todos os tipos com casos "órfãos" naquele slug. Só renomear/reordenar.
  if (stage?.service_type_id === GLOBAL_FUNNEL_SERVICE_TYPE_ID) {
    throw new PipelineServiceError(
      "O funil único não permite excluir etapas (evita órfãos em todos os tipos). Você pode renomear e reordenar. Para remover etapas, edite o funil por tipo no Operacional.",
      409,
    );
  }

  // ITEM 6.1 — a guarda "há casos nesta etapa" precisa contar corretamente.
  // Para etapas do funil ÚNICO a contagem por stage_*_id do SENTINELA é sempre 0
  // (os casos carregam o stage_*_id do SEU tipo, não do sentinela). Já para etapas
  // PER-TIPO, contamos por stage_op_id/stage_fin_id (op/fin) OU por
  // macrostatus_comercial = slug (comercial não tem projeção stage_comercial_id
  // garantida na guarda). Como este ramo (per-tipo) chega aqui, contamos assim:
  //   - op  → stage_op_id = id  OU  (service_type_id, macrostatus_op = slug)
  //   - fin → stage_fin_id = id OU  (service_type_id, macrostatus_fin = slug)
  //   - comercial → (service_type_id, macrostatus_comercial = slug)
  let count = 0;
  if (stage) {
    if (stage.kind === "comercial") {
      const { count: c } = await sb
        .from("system_cases")
        .select("id", { count: "exact", head: true })
        .eq("service_type_id", stage.service_type_id)
        .eq("macrostatus_comercial", stage.slug)
        .is("deleted_at", null);
      count = c ?? 0;
    } else {
      const macroCol = stage.kind === "fin" ? "macrostatus_fin" : "macrostatus_op";
      const stageCol = stage.kind === "fin" ? "stage_fin_id" : "stage_op_id";
      const { count: c } = await sb
        .from("system_cases")
        .select("id", { count: "exact", head: true })
        .or(
          `${stageCol}.eq.${id},and(service_type_id.eq.${stage.service_type_id},${macroCol}.eq.${stage.slug})`,
        )
        .is("deleted_at", null);
      count = c ?? 0;
    }
  } else {
    // Fallback (etapa não encontrada por algum motivo) — guarda antiga por stage_*_id.
    const { count: c } = await sb
      .from("system_cases")
      .select("id", { count: "exact", head: true })
      .or(`stage_op_id.eq.${id},stage_fin_id.eq.${id}`)
      .is("deleted_at", null);
    count = c ?? 0;
  }
  if (count > 0) {
    throw new PipelineServiceError("Há casos nesta etapa — remaneje antes de excluir", 409);
  }

  // S2-02 (R-ARCH-7) — bloqueia também se houver checklist items ancorados por
  // (service_type_id, stage_slug) — a ancoragem do checklist é por slug.
  if (stage) {
    const itemCount = await countChecklistItemsForStage(stage.service_type_id, stage.slug);
    if (itemCount > 0) {
      throw new PipelineServiceError(
        "Há itens de checklist de casos nesta etapa — remaneje antes de excluir",
        409,
      );
    }
  }

  const { error } = await sb
    .from("system_pipeline_stages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new PipelineServiceError(error.message, 500);
  return { ok: true as const, id };
}

// ------------------------------------------------------------------- Casos
export async function listAllBifurcatedCases(viewerUserId?: string) {
  const sb = getSupabaseAdmin();
  const visible = await getVisibleCaseIds(viewerUserId);
  if (visible !== null && visible.length === 0) return [];
  let q = sb
    .from("system_cases_active")
    .select("*")
    .neq("macrostatus_fin", "NAO_APLICAVEL")
    .order("created_at", { ascending: false });
  if (visible !== null) q = q.in("id", visible);
  const { data, error } = await q;
  if (error) throw new PipelineServiceError(error.message, 500);
  return data ?? [];
}

export async function listCasesByServiceType(serviceTypeId: string, viewerUserId?: string) {
  const sb = getSupabaseAdmin();
  const visible = await getVisibleCaseIds(viewerUserId);
  if (visible !== null && visible.length === 0) return [];
  let q = sb
    .from("system_cases_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .order("created_at", { ascending: false });
  if (visible !== null) q = q.in("id", visible);
  const { data, error } = await q;
  if (error) throw new PipelineServiceError(error.message, 500);
  const rows = data ?? [];
  if (rows.length === 0) return rows;

  // A4 (2026-08-03) — o PrincipalKanban (Mais Médicos) NÃO mostra casos que foram
  // MOVIDOS EXCLUSIVAMENTE para um board custom (system_case_board_positions com
  // exclusive=true, ativas). "Duplicados" (exclusive=false) e casos sem posição
  // (os 381 importados) seguem aparecendo. Filtro via NOT EXISTS aplicado só aqui,
  // sem tocar macrostatus_op / a view / o trigger. Regressão zero.
  const { data: excl } = await sb
    .from("system_case_board_positions_active")
    .select("case_id")
    .eq("exclusive", true)
    .in(
      "case_id",
      rows.map((c) => c.id),
    );
  if (excl && excl.length > 0) {
    const moved = new Set(excl.map((p) => p.case_id as string));
    return rows.filter((c) => !moved.has(c.id));
  }
  return rows;
}

// R5-04 (B5) — Resolve o service_type_id de um caso ATIVO, replicando a lógica do
// trigger system_fn_sync_stage_ids (ADR-007): se a coluna já está preenchida usa-a;
// senão deriva do case_type (slug do tipo). Carrega o caso com a guarda
// `deleted_at IS NULL` (C3) para nunca mover/consultar um caso soft-deletado.
// Retorna também organization_id/case_type para o caller. Lança 404 se o caso não
// existir (ou estiver soft-deletado) e 422 se não houver tipo resolvível.
async function loadActiveCaseWithServiceType(
  sb: ReturnType<typeof getSupabaseAdmin>,
  caseId: string,
) {
  const { data: caso, error } = await sb
    .from("system_cases")
    .select("id, organization_id, case_type, service_type_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (error || !caso) throw new PipelineServiceError("Caso não encontrado", 404);

  let serviceTypeId = caso.service_type_id ?? null;
  if (!serviceTypeId && caso.case_type) {
    const { data: st } = await sb
      .from("system_service_types")
      .select("id")
      .eq("organization_id", caso.organization_id)
      .eq("slug", caso.case_type)
      .is("deleted_at", null)
      .single();
    serviceTypeId = st?.id ?? null;
  }
  if (!serviceTypeId) {
    throw new PipelineServiceError(
      "Caso sem tipo de serviço resolvido — defina a categoria antes de mover a etapa.",
      422,
    );
  }
  return { ...caso, serviceTypeId };
}

// R5-04 (B5) — Carrega a etapa-destino GARANTINDO que ela pertence ao
// service_type_id do caso e ao kind esperado. Sem isso, o Kanban poderia oferecer
// (ou o RPC receber) uma etapa de OUTRO tipo cujo slug não existe para este caso —
// a projeção do trigger deixaria stage_*_id NULL silenciosamente. Devolve 422
// legível em vez de 500 opaco / NULL silencioso.
//
// FIX 2026-07-19 (bug do 422 ao mover card na financeira): o board financeiro é
// ÚNICO (#16) — as colunas vêm do FUNIL SENTINELA (GLOBAL_FUNNEL_SERVICE_TYPE_ID),
// então o stageId que chega no move é do sentinela, NÃO do service_type real do
// caso. A validação original (só service_type do caso) rejeitava tudo com 422.
// Aceitamos as etapas do funil sentinela também: o dual-write grava
// macrostatus_* = slug e o trigger projeta stage_*_id pelo slug no tipo do caso
// (o funil único compartilha os mesmos slugs). Continua barrando etapa de um
// tipo ALHEIO (nem o do caso, nem o sentinela).
async function loadStageForServiceType(
  sb: ReturnType<typeof getSupabaseAdmin>,
  stageId: string,
  serviceTypeId: string,
  kind: StageKind,
  invalidMsg: string,
) {
  const { data: stage, error } = await sb
    .from("system_pipeline_stages")
    .select("slug, kind, service_type_id")
    .eq("id", stageId)
    .in("service_type_id", [serviceTypeId, GLOBAL_FUNNEL_SERVICE_TYPE_ID])
    .eq("kind", kind)
    .is("deleted_at", null)
    .single();
  if (error || !stage) throw new PipelineServiceError(invalidMsg, 422);
  return stage;
}

// Move o caso para uma etapa op. Dual-write: grava macrostatus_op = slug
// (o trigger projeta stage_op_id) — mantém a bifurcação atual funcionando.
export async function moveCaseToStageOp(caseId: string, stageId: string) {
  const sb = getSupabaseAdmin();
  // C3 + AC-3: carrega o caso ATIVO (deleted_at IS NULL) e resolve o tipo.
  const caso = await loadActiveCaseWithServiceType(sb, caseId);
  // AC-2: a etapa-destino tem de pertencer ao tipo deste caso.
  const stage = await loadStageForServiceType(
    sb,
    stageId,
    caso.serviceTypeId,
    "op",
    "Etapa operacional inválida para o tipo deste caso.",
  );

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_op: stage.slug })
    .eq("id", caseId)
    .is("deleted_at", null)
    .select("id, stage_op_id, macrostatus_op")
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao mover caso", 500);

  // (2026-07-09) — checklist é SÓ do financeiro. No operacional NÃO instanciamos.
  return data;
}

// Move o caso para uma etapa financeira (dual-write via slug).
export async function moveCaseToStageFin(caseId: string, stageId: string) {
  const sb = getSupabaseAdmin();
  // C3 + AC-3: carrega o caso ATIVO (deleted_at IS NULL) e resolve o tipo.
  const caso = await loadActiveCaseWithServiceType(sb, caseId);
  // AC-2: a etapa-destino tem de pertencer ao tipo deste caso.
  const stage = await loadStageForServiceType(
    sb,
    stageId,
    caso.serviceTypeId,
    "fin",
    "Etapa financeira inválida para o tipo deste caso.",
  );

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_fin: stage.slug })
    .eq("id", caseId)
    .is("deleted_at", null)
    .select("id, stage_fin_id, macrostatus_fin")
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao mover caso", 500);

  // S3-02 — instancia os itens de checklist da etapa fin de destino (idempotente,
  // server-side, dentro da transição — cobre o DnD do Kanban financeiro).
  await instanciarChecklist(caseId, stage.slug).catch(() => {});

  return data;
}

// ----------------------------------------------------------- Leads (comercial)
// Lista os casos de um tipo de serviço que ENTRARAM no fluxo comercial para o
// Kanban "Comercial" (S9-08). Fonte de verdade: lifecycle='LEAD' (S5-02) — casos
// que viraram CLIENTE/PERDIDO saem daqui automaticamente — E que já têm
// procuração ENVIADA (aguardando_assinatura_at) OU ASSINADA (procuracao_assinada_at).
// Casos que são só cadastro (sem procuração enviada) aparecem apenas no roster de
// Leads (Inteligência › Leads), NÃO no Kanban Comercial.
export async function listLeadsByServiceType(serviceTypeId: string, viewerUserId?: string) {
  const sb = getSupabaseAdmin();
  const visible = await getVisibleCaseIds(viewerUserId);
  if (visible !== null && visible.length === 0) return [];
  let q = sb
    .from("system_cases_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .eq("lifecycle", "LEAD")
    .or("aguardando_assinatura_at.not.is.null,procuracao_assinada_at.not.is.null")
    .order("created_at", { ascending: false });
  if (visible !== null) q = q.in("id", visible);
  const { data, error } = await q;
  if (error) throw new PipelineServiceError(error.message, 500);
  return data ?? [];
}

// #15 — Board comercial ÚNICO. Retorna, num só conjunto:
//   (a) casos comerciais (lifecycle='LEAD', não perdidos) de TODOS os tipos, na
//       etapa comercial atual (macrostatus_comercial);
//   (b) cadastros que ainda NÃO são clientes e NÃO têm caso comercial — como
//       "leads" sintéticos na 1ª etapa (NOVO), pra que TODO cadastro novo apareça
//       automaticamente no comercial (sem exigir procuração enviada).
// Cards com is_registration=true não têm caso: a UI aponta pra ficha do cadastro.
export type ComercialBoardRow = {
  id: string; // case_id (caso) OU client_id (cadastro sintético)
  client_id: string;
  case_code: string;
  case_type: string;
  macrostatus_comercial: string | null;
  created_at: string;
  client_name: string;
  is_registration: boolean;
};

export async function listComercialBoard(viewerUserId?: string): Promise<ComercialBoardRow[]> {
  const sb = getSupabaseAdmin();
  const visibleClients = await getVisibleClientIds(viewerUserId);
  if (visibleClients !== null && visibleClients.length === 0) return [];

  // ITEM 1 (2026-07-07) — funil comercial por CADASTRO. Um card por cadastro
  // (pessoa) que ainda NÃO é cliente. A etapa comercial vive no PRÓPRIO cadastro
  // (system_clients.macrostatus_comercial) — arrastar o card só atualiza essa
  // coluna, sem criar caso, sem semear financeiro e sem gerar documento. A
  // vinculação de um CASO ao cadastro é 100% manual (feita pelo usuário).

  // Cadastros que já viraram CLIENTE (têm algum caso lifecycle='CLIENTE') saem
  // do funil comercial — eles graduaram.
  const { data: clienteCases } = await sb
    .from("system_cases_active")
    .select("client_id")
    .eq("lifecycle", "CLIENTE");
  const clienteIds = new Set((clienteCases ?? []).map((c) => c.client_id));

  // Todos os cadastros ativos (select "*" porque macrostatus_comercial ainda não
  // está nos tipos gerados — lido via cast defensivo).
  let clientsQ = sb
    .from("system_clients")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (visibleClients !== null) clientsQ = clientsQ.in("id", visibleClients);
  const { data: clients, error: cErr } = await clientsQ;
  if (cErr) throw new PipelineServiceError(cErr.message, 500);

  return (
    (clients ?? [])
      // Sai do funil comercial quem já é CLIENTE: por caso assinado OU marcado
      // manualmente (chave no cadastro / botão "Tornar cliente") — 2026-07-19.
      .filter(
        (cli) =>
          !clienteIds.has(cli.id) &&
          !(cli as { marcado_cliente_at?: string | null }).marcado_cliente_at,
      )
      .map((cli) => ({
        id: cli.id,
        client_id: cli.id,
        case_code: "—",
        case_type: "",
        macrostatus_comercial:
          (cli as { macrostatus_comercial?: string | null }).macrostatus_comercial ?? "NOVO",
        created_at: cli.created_at,
        client_name: cli.full_name,
        is_registration: true,
      }))
  );
}

// Visão consolidada de todos os leads (para o índice/resumo do CRM).
export async function listLeadsPipeline(viewerUserId?: string) {
  const sb = getSupabaseAdmin();
  const visible = await getVisibleCaseIds(viewerUserId);
  if (visible !== null && visible.length === 0) return [];
  let q = sb
    .from("system_cases_active")
    .select("*")
    .eq("lifecycle", "LEAD")
    .order("created_at", { ascending: false });
  if (visible !== null) q = q.in("id", visible);
  const { data, error } = await q;
  if (error) throw new PipelineServiceError(error.message, 500);
  return data ?? [];
}

// Move o lead para uma etapa comercial. Dual-write: grava macrostatus_comercial =
// slug (o trigger projeta stage_comercial_id). Idempotente (from === to → no-op) e
// grava evento comercial_status_changed com o diff. Molde de moveCaseToStageOp.
export async function moveCaseToStageComercial(
  caseId: string,
  stageId: string,
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();
  const { data: stage, error: sErr } = await sb
    .from("system_pipeline_stages")
    .select("slug, kind")
    .eq("id", stageId)
    .single();
  if (sErr || !stage || stage.kind !== "comercial")
    throw new PipelineServiceError("Etapa comercial inválida", 422);

  const { data: caso, error: cErr } = await sb
    .from("system_cases")
    .select("id, organization_id, macrostatus_comercial")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (cErr || !caso) throw new PipelineServiceError("Caso não encontrado", 404);

  const from = caso.macrostatus_comercial ?? null;

  // Idempotente: mover para a mesma etapa não duplica evento nem UPDATE.
  if (from === stage.slug) {
    return { id: caseId, macrostatus_comercial: from, stage_comercial_id: null, noop: true };
  }

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_comercial: stage.slug })
    .eq("id", caseId)
    .is("deleted_at", null)
    .select("id, stage_comercial_id, macrostatus_comercial")
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao mover lead", 500);

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: caso.organization_id,
    action: "comercial_status_changed",
    diff: { from, to: stage.slug },
    triggered_by: triggeredBy ?? null,
  });

  return data;
}

// ITEM 1 (2026-07-07) — move um CADASTRO (lead) entre etapas comerciais. A etapa
// é gravada em system_clients.macrostatus_comercial. NÃO cria caso, não semeia
// financeiro e não gera documento. Idempotente. Auditado (não há case_event, pois
// não há caso — usamos system_audit_log).
export async function moveLeadStageComercial(clientId: string, stageId: string) {
  const sb = getSupabaseAdmin();
  const { data: stage, error: sErr } = await sb
    .from("system_pipeline_stages")
    .select("slug, kind")
    .eq("id", stageId)
    .single();
  if (sErr || !stage || stage.kind !== "comercial")
    throw new PipelineServiceError("Etapa comercial inválida", 422);

  const { data: cli, error: cErr } = await sb
    .from("system_clients")
    .select("id, organization_id")
    .eq("id", clientId)
    .is("deleted_at", null)
    .single();
  if (cErr || !cli) throw new PipelineServiceError("Cadastro não encontrado", 404);

  const { error } = await sb
    .from("system_clients")
    .update({ macrostatus_comercial: stage.slug } as never)
    .eq("id", clientId)
    .is("deleted_at", null);
  if (error) throw new PipelineServiceError(error.message ?? "Falha ao mover lead", 500);

  await sb
    .from("system_audit_log")
    .insert({
      organization_id: cli.organization_id,
      action: "lead.comercial_stage_changed",
      entity_type: "client",
      entity_id: clientId,
    })
    .then(
      () => {},
      () => {},
    );

  return { id: clientId, macrostatus_comercial: stage.slug };
}

// Bifurcação por botão (ADR-009) — idempotente via função do banco.
// DEPRECADA pela S19 (`entrarNoFinanceiro`); mantida como caminho de rollback de D2.
export async function bifurcarCaseToFinanceiro(caseId: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc("system_fn_bifurcar_financeiro", { p_case_id: caseId });
  if (error) throw new PipelineServiceError(error.message, 500);
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "case.bifurcar_financeiro",
    entity_type: "case",
    entity_id: caseId,
  });
  return { ok: true as const };
}

// Entrada no financeiro pelo popup (S19 / ADR-012..014). Idempotente.
// `removerOperacional=false` → Duplicar (fica nas 2 pipelines).
// `removerOperacional=true`  → Somente financeiro (sai do Kanban op, reversível).
export async function entrarNoFinanceiro(caseId: string, removerOperacional: boolean) {
  const sb = getSupabaseAdmin();
  // Cast: as funções entram no types.ts só após `db:push` + `db:types`.
  const { error } = await sb.rpc(
    "system_fn_entrar_financeiro" as never,
    {
      p_case_id: caseId,
      p_remover_operacional: removerOperacional,
    } as never,
  );
  if (error) {
    // Pré-condição de negócio (caso sem tipo / tipo sem etapa fin) → 424 (a Vercel
    // mascara 5xx; 424 deixa a mensagem chegar ao front).
    const status = /no_data_found|check_violation|não encontrado|etapa financeira/i.test(
      `${error.code ?? ""} ${error.message}`,
    )
      ? 424
      : 500;
    throw new PipelineServiceError(error.message, status);
  }
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "case.entrar_financeiro",
    entity_type: "case",
    entity_id: caseId,
    diff: { removerOperacional } as never,
  });

  // S3-02 — ao bifurcar, o caso entrou na 1ª etapa fin real. Instancia o checklist
  // dessa etapa (idempotente, server-side) para o gate fin ter o que avaliar.
  const { data: caso } = await sb
    .from("system_cases")
    .select("macrostatus_fin")
    .eq("id", caseId)
    .single();
  if (caso?.macrostatus_fin && caso.macrostatus_fin !== "NAO_APLICAVEL") {
    await instanciarChecklist(caseId, caso.macrostatus_fin).catch(() => {});
  }

  return { ok: true as const, removerOperacional };
}

// Reverter "somente financeiro" — traz o caso de volta ao operacional (S19 / D1).
// Não altera o estado financeiro do caso. Idempotente.
export async function voltarAoOperacional(caseId: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc(
    "system_fn_voltar_ao_operacional" as never,
    {
      p_case_id: caseId,
    } as never,
  );
  if (error) throw new PipelineServiceError(error.message, 500);
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "case.voltar_operacional",
    entity_type: "case",
    entity_id: caseId,
  });
  return { ok: true as const };
}

// Marcação "acerto parcial / judicial" (ADR-010) — acompanha o caso.
export async function setAcertoParcial(
  caseId: string,
  input: { acerto_parcial: boolean; tem_pendencia_judicial: boolean; obs?: string | null },
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases")
    .update({
      acerto_parcial: input.acerto_parcial,
      tem_pendencia_judicial: input.tem_pendencia_judicial,
      acerto_parcial_obs: input.obs ?? null,
    })
    .eq("id", caseId)
    .select("id, acerto_parcial, tem_pendencia_judicial, acerto_parcial_obs")
    .single();
  if (error || !data)
    throw new PipelineServiceError(error?.message ?? "Falha ao marcar acerto", 500);
  return data;
}
