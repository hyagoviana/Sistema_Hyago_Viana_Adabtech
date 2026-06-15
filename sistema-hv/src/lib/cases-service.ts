// Server-only — CRUD de casos + timeline + audit.
// NUNCA importe no browser.

import { type MacroFin, type MacroOp } from "./cases/constants";
import { getSupabaseAdmin } from "./supabase/server";
import type { CaseCreateOutput, CaseUpdateOutput } from "./validators/case";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class CaseServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CaseServiceError";
  }
}

// ----------------------------------------------------------------------------
// case_code generator: HV-{TIPO}-{YEAR}-{NNNN}
// ----------------------------------------------------------------------------
async function nextCaseCode(caseType: string): Promise<string> {
  const sb = getSupabaseAdmin();
  // Tenta via RPC genérico — se não tiver função, faz query bruta via PostgREST.
  // Pra simplicidade: usa SQL inline via service_role.
  const { data, error } = await sb.rpc("nextval_seq_system_case_code");
  if (error) {
    // Fallback: timestamp-based (raro — só se a função RPC não existir)
    const fallback = Date.now().toString().slice(-5);
    return `HV-${caseType}-${new Date().getFullYear()}-${fallback}`;
  }
  const n = typeof data === "number" ? data : Number(data ?? 0);
  const year = new Date().getFullYear();
  const tipoShort = caseType.split("_")[0];
  return `HV-${tipoShort}-${year}-${String(n).padStart(4, "0")}`;
}

// ----------------------------------------------------------------------------
// CREATE
// ----------------------------------------------------------------------------
export async function createCase(input: CaseCreateOutput) {
  const sb = getSupabaseAdmin();

  // Validar cliente existe e está ativo
  const { data: client, error: clientErr } = await sb
    .from("system_clients")
    .select("id")
    .eq("id", input.client_id)
    .is("deleted_at", null)
    .single();
  if (clientErr || !client) {
    throw new CaseServiceError("Cliente não encontrado ou desativado", 404);
  }

  const code = await nextCaseCode(input.case_type);

  const { data: created, error } = await sb
    .from("system_cases")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      client_id: input.client_id,
      case_code: code,
      case_type: input.case_type,
      macrostatus_op: input.macrostatus_op ?? "ONBOARDING",
      macrostatus_fin: input.macrostatus_fin ?? "NAO_APLICAVEL",
      proximo_passo: input.proximo_passo ?? null,
      responsavel: input.responsavel ?? null,
      municipio: input.municipio ?? null,
      valor_centavos: input.valor_centavos ?? null,
    })
    .select()
    .single();

  if (error || !created) {
    throw new CaseServiceError(error?.message ?? "Falha ao criar caso", 500);
  }

  await sb.from("system_case_events").insert({
    case_id: created.id,
    organization_id: DEFAULT_ORG_ID,
    action: "created",
    to_macrostatus_op: created.macrostatus_op,
    diff: { case_type: created.case_type, client_id: created.client_id },
  });

  return created;
}

// ----------------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------------
export async function updateCase(id: string, input: CaseUpdateOutput) {
  const sb = getSupabaseAdmin();

  const { data: before } = await sb
    .from("system_cases")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!before) throw new CaseServiceError("Caso não encontrado", 404);

  const { data, error } = await sb
    .from("system_cases")
    .update(input)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) {
    throw new CaseServiceError(error?.message ?? "Falha ao atualizar", 500);
  }

  // Event: se mudou status, registra transition; senão, updated genérico
  const statusChanged =
    input.macrostatus_op !== undefined && input.macrostatus_op !== before.macrostatus_op;

  await sb.from("system_case_events").insert({
    case_id: id,
    organization_id: data.organization_id,
    action: statusChanged ? "status_changed" : "updated",
    from_macrostatus_op: statusChanged ? before.macrostatus_op : null,
    to_macrostatus_op: statusChanged ? data.macrostatus_op : null,
    diff: input,
  });

  return data;
}

// ----------------------------------------------------------------------------
// SOFT-DELETE
// ----------------------------------------------------------------------------
export async function softDeleteCase(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new CaseServiceError("Caso não encontrado", 404);

  await sb.from("system_case_events").insert({
    case_id: id,
    organization_id: data.organization_id,
    action: "soft_deleted",
  });
  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// MOVE STATUS (atalho usado pelo dialog Mover do Kanban operacional)
// ----------------------------------------------------------------------------
export async function moveCaseStatus(id: string, to: MacroOp) {
  return updateCase(id, { macrostatus_op: to });
}

// ----------------------------------------------------------------------------
// MOVE STATUS FIN (Kanban financeiro)
// ----------------------------------------------------------------------------
// Regra de negócio: voltar pra NAO_APLICAVEL é bloqueado — depois que o caso
// bifurcou, o rastro financeiro vive sua vida. Cancelar fin se necessário.
export async function moveCaseStatusFin(id: string, to: MacroFin) {
  const sb = getSupabaseAdmin();
  const { data: before } = await sb
    .from("system_cases")
    .select("macrostatus_fin")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!before) throw new CaseServiceError("Caso não encontrado", 404);

  if (to === "NAO_APLICAVEL" && before.macrostatus_fin !== "NAO_APLICAVEL") {
    throw new CaseServiceError(
      "Não é permitido voltar status financeiro pra 'Não aplicável'. Use 'Cancelado' se for o caso.",
      400,
    );
  }

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_fin: to })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) {
    throw new CaseServiceError(error?.message ?? "Falha ao mover status fin", 500);
  }

  if (before.macrostatus_fin !== to) {
    await sb.from("system_case_events").insert({
      case_id: id,
      organization_id: data.organization_id,
      action: "fin_status_changed",
      diff: { from: before.macrostatus_fin, to },
    });
  }

  return data;
}

// ----------------------------------------------------------------------------
// READ
// ----------------------------------------------------------------------------
export async function listCases(filters?: {
  search?: string;
  macrostatus_op?: MacroOp;
  macrostatus_fin?: MacroFin;
  client_id?: string;
}) {
  const sb = getSupabaseAdmin();
  let query = sb.from("system_cases_active").select("*").order("created_at", { ascending: false });

  if (filters?.macrostatus_op) {
    query = query.eq("macrostatus_op", filters.macrostatus_op);
  }
  if (filters?.macrostatus_fin) {
    query = query.eq("macrostatus_fin", filters.macrostatus_fin);
  }
  if (filters?.client_id) {
    query = query.eq("client_id", filters.client_id);
  }
  if (filters?.search?.trim()) {
    const s = filters.search.trim().replace(/[,()]/g, "");
    if (s) query = query.or(`case_code.ilike.%${s}%,proximo_passo.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) throw new CaseServiceError(error.message, 500);
  return data ?? [];
}

export async function getCase(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("system_cases").select("*").eq("id", id).single();
  if (error || !data) throw new CaseServiceError("Caso não encontrado", 404);
  return data;
}

export async function listCaseEvents(caseId: string, limit = 20) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new CaseServiceError(error.message, 500);
  return data ?? [];
}
