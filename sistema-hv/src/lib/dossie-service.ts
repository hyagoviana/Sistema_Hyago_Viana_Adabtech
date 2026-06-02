// Server-only — CRUD do dossiê do caso (tarefas, prazos, comunicações).
// NUNCA importe este arquivo em código que roda no browser.
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class DossieServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DossieServiceError";
  }
}

function check(error: { message: string } | null) {
  if (error) throw new DossieServiceError(error.message, 500);
}

const now = () => new Date().toISOString();

// ----------------------------------------------------------------------------
// Tarefas
// ----------------------------------------------------------------------------
export async function listCaseTasks(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_tasks_active")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  check(error);
  return data ?? [];
}

export async function createCaseTask(input: {
  case_id: string;
  title: string;
  priority?: string;
  assignee?: string | null;
  due_date?: string | null;
  description?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_tasks")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID })
    .select()
    .single();
  check(error);
  return data;
}

export async function setCaseTaskStatus(id: string, status: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_tasks")
    .update({ status, completed_at: status === "CONCLUIDA" ? now() : null })
    .eq("id", id)
    .select()
    .single();
  check(error);
  return data;
}

export async function deleteCaseTask(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("system_case_tasks").update({ deleted_at: now() }).eq("id", id);
  check(error);
  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// Prazos
// ----------------------------------------------------------------------------
export async function listCaseDeadlines(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_deadlines_active")
    .select("*")
    .eq("case_id", caseId)
    .order("fatal_date", { ascending: true });
  check(error);
  return data ?? [];
}

export async function createCaseDeadline(input: {
  case_id: string;
  title: string;
  fatal_date: string;
  recommended_date?: string | null;
  tipo?: string | null;
  responsible?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_deadlines")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID })
    .select()
    .single();
  check(error);
  return data;
}

export async function setCaseDeadlineStatus(id: string, status: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_deadlines")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  check(error);
  return data;
}

export async function deleteCaseDeadline(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_case_deadlines")
    .update({ deleted_at: now() })
    .eq("id", id);
  check(error);
  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// Comunicações
// ----------------------------------------------------------------------------
export async function listCaseCommunications(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_communications_active")
    .select("*")
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: false });
  check(error);
  return data ?? [];
}

export async function createCaseCommunication(input: {
  case_id: string;
  summary: string;
  channel?: string;
  direction?: string;
  contact?: string | null;
  content?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_communications")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID })
    .select()
    .single();
  check(error);
  return data;
}

export async function deleteCaseCommunication(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_case_communications")
    .update({ deleted_at: now() })
    .eq("id", id);
  check(error);
  return { ok: true as const, id };
}
