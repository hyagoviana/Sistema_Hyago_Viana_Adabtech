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
    .from("system_case_tasks")
    .select("*, assigned_user:system_users!assignee_id(id, full_name)")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  check(error);
  return (data ?? []).map((t) => ({
    ...t,
    assignee_name: (t.assigned_user as { id: string; full_name: string } | null)?.full_name ?? t.assignee ?? null,
    assigned_user: undefined,
  }));
}

export async function createCaseTask(
  input: {
    case_id: string;
    title: string;
    priority?: string;
    assignee?: string | null;
    assignee_id?: string | null;
    due_date?: string | null;
    description?: string | null;
  },
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_tasks")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID })
    .select()
    .single();
  check(error);

  // Registra evento na timeline do caso
  if (data) {
    await sb.from("system_case_events").insert({
      case_id: input.case_id,
      organization_id: DEFAULT_ORG_ID,
      action: "task_created",
      diff: { task_title: input.title, assignee_id: input.assignee_id ?? null },
      triggered_by: triggeredBy ?? null,
    });
  }

  return data;
}

export async function setCaseTaskStatus(id: string, status: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_tasks")
    .update({ status, completed_at: status === "CONCLUIDA" ? now() : null })
    .eq("id", id)
    .select()
    .single();
  check(error);

  // Registra evento na timeline do caso quando tarefa é concluída
  if (data && status === "CONCLUIDA") {
    await sb.from("system_case_events").insert({
      case_id: data.case_id,
      organization_id: DEFAULT_ORG_ID,
      action: "task_completed",
      diff: { task_title: data.title, task_id: id },
      triggered_by: triggeredBy ?? null,
    });
  }

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

// ----------------------------------------------------------------------------
// Agregação global (visão "Tarefas" e painel "Hoje") — enriquece com o caso
// ----------------------------------------------------------------------------
async function caseLookup(sb: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await sb.from("system_cases_active").select("id, case_code, client_name");
  const map = new Map<string, { case_code: string; client_name: string }>();
  (data ?? []).forEach((c) =>
    map.set(c.id, { case_code: c.case_code, client_name: c.client_name }),
  );
  return map;
}

export async function listAllTasks() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_tasks_active")
    .select("id, case_id, title, status, priority, assignee, assignee_id, due_date, created_at")
    .order("due_date", { ascending: true, nullsFirst: false });
  check(error);
  const map = await caseLookup(sb);
  return (data ?? []).map((t) => ({
    ...t,
    case_code: map.get(t.case_id)?.case_code ?? "—",
    client_name: map.get(t.case_id)?.client_name ?? "—",
  }));
}

export async function listAllDeadlines() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_deadlines_active")
    .select("id, case_id, title, tipo, fatal_date, recommended_date, status, responsible")
    .order("fatal_date", { ascending: true });
  check(error);
  const map = await caseLookup(sb);
  return (data ?? []).map((d) => ({
    ...d,
    case_code: map.get(d.case_id)?.case_code ?? "—",
    client_name: map.get(d.case_id)?.client_name ?? "—",
  }));
}
