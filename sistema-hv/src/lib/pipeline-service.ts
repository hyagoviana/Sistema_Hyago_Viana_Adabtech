// Server-only — Tipos de Serviço + Etapas de pipeline (configuráveis) e
// movimentação de casos por etapa. Dual-write: a UI move por stage, mas
// gravamos macrostatus_* = slug da etapa (o trigger projeta stage_*), mantendo
// a bifurcação atual intacta (ADR-007).

import { countChecklistItemsForStage, instanciarChecklist } from "./checklist-service";
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

  // Semeia etapas padrão (op + fin) para a categoria nascer usável; o dono edita depois.
  const defaults = [
    { kind: "op", slug: "NOVO", label: "Novo", ordem: 0, stage_role: "normal" },
    { kind: "op", slug: "EM_ANDAMENTO", label: "Em andamento", ordem: 1, stage_role: "normal" },
    { kind: "op", slug: "GANHO", label: "Ganho", ordem: 2, stage_role: "won" },
    { kind: "op", slug: "ENCERRADO", label: "Encerrado", ordem: 3, stage_role: "closed" },
    { kind: "op", slug: "CANCELADO", label: "Cancelado", ordem: 4, stage_role: "lost" },
    { kind: "fin", slug: "ELABORANDO", label: "Elaborando", ordem: 0, stage_role: "normal" },
    { kind: "fin", slug: "ATIVO", label: "Ativo", ordem: 1, stage_role: "normal" },
    { kind: "fin", slug: "QUITADO", label: "Quitado", ordem: 2, stage_role: "closed" },
    { kind: "fin", slug: "CANCELADO", label: "Cancelado", ordem: 3, stage_role: "lost" },
    // S5-01 — esteira comercial (leads): novo tipo nasce com o funil de leads usável.
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
  // Bloqueia remover etapa com casos parados nela.
  const { count } = await sb
    .from("system_cases")
    .select("id", { count: "exact", head: true })
    .or(`stage_op_id.eq.${id},stage_fin_id.eq.${id}`)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new PipelineServiceError("Há casos nesta etapa — remaneje antes de excluir", 409);
  }

  // S2-02 (R-ARCH-7) — bloqueia também se houver checklist items ancorados por
  // (service_type_id, stage_slug) — a ancoragem do checklist é por slug.
  const { data: stage } = await sb
    .from("system_pipeline_stages")
    .select("service_type_id, slug")
    .eq("id", id)
    .single();
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
export async function listAllBifurcatedCases() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases_active")
    .select("*")
    .neq("macrostatus_fin", "NAO_APLICAVEL")
    .order("created_at", { ascending: false });
  if (error) throw new PipelineServiceError(error.message, 500);
  return data ?? [];
}

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
  if (sErr || !stage || stage.kind !== "op")
    throw new PipelineServiceError("Etapa operacional inválida", 422);

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_op: stage.slug })
    .eq("id", caseId)
    .select("id, stage_op_id, macrostatus_op")
    .single();
  if (error || !data) throw new PipelineServiceError(error?.message ?? "Falha ao mover caso", 500);

  // S2-03 — instancia os itens de checklist da etapa de destino (idempotente,
  // server-side, dentro da transição — cobre o caminho do DnD do Kanban).
  await instanciarChecklist(caseId, stage.slug).catch(() => {});

  return data;
}

// Move o caso para uma etapa financeira (dual-write via slug).
export async function moveCaseToStageFin(caseId: string, stageId: string) {
  const sb = getSupabaseAdmin();
  const { data: stage, error: sErr } = await sb
    .from("system_pipeline_stages")
    .select("slug, kind")
    .eq("id", stageId)
    .single();
  if (sErr || !stage || stage.kind !== "fin")
    throw new PipelineServiceError("Etapa financeira inválida", 422);

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_fin: stage.slug })
    .eq("id", caseId)
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
export async function listLeadsByServiceType(serviceTypeId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases_active")
    .select("*")
    .eq("service_type_id", serviceTypeId)
    .eq("lifecycle", "LEAD")
    .or("aguardando_assinatura_at.not.is.null,procuracao_assinada_at.not.is.null")
    .order("created_at", { ascending: false });
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

export async function listComercialBoard(): Promise<ComercialBoardRow[]> {
  const sb = getSupabaseAdmin();

  // (a) Casos comerciais (leads não perdidos), todos os tipos.
  const { data: cases, error } = await sb
    .from("system_cases_active")
    .select(
      "id, client_id, case_code, case_type, macrostatus_comercial, created_at, client_name, perdido_at",
    )
    .eq("lifecycle", "LEAD")
    .order("created_at", { ascending: false });
  if (error) throw new PipelineServiceError(error.message, 500);

  const caseRows: ComercialBoardRow[] = (cases ?? [])
    .filter((c) => !(c as { perdido_at?: string | null }).perdido_at)
    .map((c) => ({
      id: c.id,
      client_id: c.client_id,
      case_code: c.case_code,
      case_type: c.case_type,
      macrostatus_comercial: c.macrostatus_comercial ?? "NOVO",
      created_at: c.created_at,
      client_name: c.client_name,
      is_registration: false,
    }));

  // Cadastros que já têm caso comercial (LEAD) ou já são clientes (CLIENTE) não
  // viram card sintético.
  const withCase = new Set(caseRows.map((r) => r.client_id));
  const { data: clienteCases } = await sb
    .from("system_cases_active")
    .select("client_id")
    .eq("lifecycle", "CLIENTE");
  const clienteIds = new Set((clienteCases ?? []).map((c) => c.client_id));

  // (b) Cadastros puros (sem caso comercial e não-clientes) → NOVO sintético.
  const { data: clients, error: cErr } = await sb
    .from("system_clients")
    .select("id, full_name, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (cErr) throw new PipelineServiceError(cErr.message, 500);

  const regRows: ComercialBoardRow[] = (clients ?? [])
    .filter((cli) => !withCase.has(cli.id) && !clienteIds.has(cli.id))
    .map((cli) => ({
      id: cli.id,
      client_id: cli.id,
      case_code: "—",
      case_type: "",
      macrostatus_comercial: "NOVO",
      created_at: cli.created_at,
      client_name: cli.full_name,
      is_registration: true,
    }));

  return [...caseRows, ...regRows];
}

// Visão consolidada de todos os leads (para o índice/resumo do CRM).
export async function listLeadsPipeline() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases_active")
    .select("*")
    .eq("lifecycle", "LEAD")
    .order("created_at", { ascending: false });
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
