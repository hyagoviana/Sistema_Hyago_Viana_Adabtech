// Server-only — CRUD do dossiê do caso (tarefas, prazos, comunicações).
// NUNCA importe este arquivo em código que roda no browser.
import { seesOnlyOwnCases, type Role } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";
import { getUserRole } from "./users-service";

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

  // Registra evento na timeline do caso para qualquer mudança de status
  if (data) {
    const action =
      status === "CONCLUIDA"
        ? "task_completed"
        : status === "EM_ANDAMENTO"
          ? "task_started"
          : "task_status_changed";
    await sb.from("system_case_events").insert({
      case_id: data.case_id,
      organization_id: DEFAULT_ORG_ID,
      action,
      diff: { task_title: data.title, task_id: id, status },
      triggered_by: triggeredBy ?? null,
    });
  }

  return data;
}

export async function deleteCaseTask(id: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  // Busca dados antes de deletar para o evento
  const { data: task } = await sb
    .from("system_case_tasks")
    .select("case_id, title")
    .eq("id", id)
    .single();
  const { error } = await sb.from("system_case_tasks").update({ deleted_at: now() }).eq("id", id);
  check(error);

  if (task) {
    await sb.from("system_case_events").insert({
      case_id: task.case_id,
      organization_id: DEFAULT_ORG_ID,
      action: "task_deleted",
      diff: { task_title: task.title, task_id: id },
      triggered_by: triggeredBy ?? null,
    });
  }

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

export async function createCaseDeadline(
  input: {
    case_id: string;
    title: string;
    fatal_date: string;
    recommended_date?: string | null;
    tipo?: string | null;
    responsible?: string | null;
  },
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_deadlines")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID })
    .select()
    .single();
  check(error);

  if (data) {
    await sb.from("system_case_events").insert({
      case_id: input.case_id,
      organization_id: DEFAULT_ORG_ID,
      action: "deadline_created",
      diff: { deadline_title: input.title, fatal_date: input.fatal_date, tipo: input.tipo ?? null },
      triggered_by: triggeredBy ?? null,
    });
  }

  return data;
}

export async function setCaseDeadlineStatus(id: string, status: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_deadlines")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  check(error);

  if (data) {
    const action = status === "CUMPRIDO" ? "deadline_completed" : status === "PERDIDO" ? "deadline_missed" : "deadline_status_changed";
    await sb.from("system_case_events").insert({
      case_id: data.case_id,
      organization_id: DEFAULT_ORG_ID,
      action,
      diff: { deadline_title: data.title, status },
      triggered_by: triggeredBy ?? null,
    });
  }

  return data;
}

export async function deleteCaseDeadline(id: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { data: dl } = await sb
    .from("system_case_deadlines")
    .select("case_id, title")
    .eq("id", id)
    .single();
  const { error } = await sb
    .from("system_case_deadlines")
    .update({ deleted_at: now() })
    .eq("id", id);
  check(error);

  if (dl) {
    await sb.from("system_case_events").insert({
      case_id: dl.case_id,
      organization_id: DEFAULT_ORG_ID,
      action: "deadline_deleted",
      diff: { deadline_title: dl.title },
      triggered_by: triggeredBy ?? null,
    });
  }

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

export async function createCaseCommunication(
  input: {
    case_id: string;
    summary: string;
    channel?: string;
    direction?: string;
    contact?: string | null;
    content?: string | null;
  },
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_communications")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID })
    .select()
    .single();
  check(error);

  if (data) {
    await sb.from("system_case_events").insert({
      case_id: input.case_id,
      organization_id: DEFAULT_ORG_ID,
      action: "communication_logged",
      diff: { summary: input.summary, channel: input.channel ?? "OUTRO", direction: input.direction ?? "OUT" },
      triggered_by: triggeredBy ?? null,
    });
  }

  return data;
}

export async function deleteCaseCommunication(id: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { data: comm } = await sb
    .from("system_case_communications")
    .select("case_id, summary, channel")
    .eq("id", id)
    .single();
  const { error } = await sb
    .from("system_case_communications")
    .update({ deleted_at: now() })
    .eq("id", id);
  check(error);

  if (comm) {
    await sb.from("system_case_events").insert({
      case_id: comm.case_id,
      organization_id: DEFAULT_ORG_ID,
      action: "communication_deleted",
      diff: { summary: comm.summary, channel: comm.channel },
      triggered_by: triggeredBy ?? null,
    });
  }

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
    .from("system_case_tasks")
    .select("id, case_id, title, status, priority, assignee, assignee_id, due_date, created_at")
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  check(error);
  const map = await caseLookup(sb);
  return (data ?? []).map((t) => ({
    ...t,
    case_code: map.get(t.case_id)?.case_code ?? "—",
    client_name: map.get(t.case_id)?.client_name ?? "—",
  }));
}

// ----------------------------------------------------------------------------
// AGREGAÇÃO "TAREFAS" — tudo vinculado a um colaborador: tarefas do caso +
// itens de checklist com responsável. RBAC: quem só vê os próprios casos
// (advogado etc.) só recebe o que está atribuído A SI; admin/back-office veem
// tudo e podem filtrar por colaborador.
// ----------------------------------------------------------------------------
export type WorkItem = {
  id: string;
  type: "tarefa" | "checklist";
  case_id: string;
  case_code: string;
  client_name: string;
  title: string;
  status: string;
  priority: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  stage_slug: string | null;
};

export async function listWorkItems(
  viewerId: string,
  filters?: {
    assigneeId?: string | null;
    caseId?: string | null;
    status?: string | null;
    search?: string | null;
  },
): Promise<{ items: WorkItem[]; canSeeAll: boolean }> {
  const sb = getSupabaseAdmin();
  const role = await getUserRole(viewerId);
  // Papéis que só veem os próprios casos → escopo travado em si mesmo.
  const canSeeAll = !seesOnlyOwnCases((role ?? "") as Role);
  const scopeAssignee = canSeeAll ? (filters?.assigneeId || null) : viewerId;

  // Tarefas (não concluídas).
  let tq = sb
    .from("system_case_tasks")
    .select("id, case_id, title, status, priority, assignee_id, due_date")
    .is("deleted_at", null)
    .neq("status", "CONCLUIDA");
  if (scopeAssignee) tq = tq.eq("assignee_id", scopeAssignee);
  if (filters?.caseId) tq = tq.eq("case_id", filters.caseId);
  const { data: tasks } = await tq;

  // Itens de checklist pendentes. Para um colaborador específico, considera tanto o
  // assigned_to (primário) quanto a N:N (responsável secundário, item 2b).
  const chkSelect =
    "id, case_id, assigned_to, stage_slug, label, done, def:system_stage_checklist_defs(label)";
  let chk: unknown[] = [];
  if (scopeAssignee) {
    const { data: links } = await sb
      .from("system_case_checklist_item_assignees")
      .select("item_id")
      .eq("user_id", scopeAssignee);
    const linkIds = (links ?? []).map((l) => (l as { item_id: string }).item_id);
    const orExpr = linkIds.length
      ? `assigned_to.eq.${scopeAssignee},id.in.(${linkIds.join(",")})`
      : `assigned_to.eq.${scopeAssignee}`;
    let cq = sb
      .from("system_case_checklist_items")
      .select(chkSelect)
      .is("deleted_at", null)
      .eq("done", false)
      .or(orExpr);
    if (filters?.caseId) cq = cq.eq("case_id", filters.caseId);
    chk = (await cq).data ?? [];
  } else {
    let cq = sb
      .from("system_case_checklist_items")
      .select(chkSelect)
      .is("deleted_at", null)
      .eq("done", false)
      .not("assigned_to", "is", null);
    if (filters?.caseId) cq = cq.eq("case_id", filters.caseId);
    chk = (await cq).data ?? [];
  }

  const map = await caseLookup(sb);
  const userIds = [
    ...new Set(
      [
        ...(tasks ?? []).map((t) => t.assignee_id),
        ...(chk ?? []).map((c) => (c as { assigned_to: string | null }).assigned_to),
      ].filter(Boolean) as string[],
    ),
  ];
  const { data: users } = userIds.length
    ? await sb.from("system_users").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name || u.email]));

  const items: WorkItem[] = [];
  for (const t of tasks ?? []) {
    items.push({
      id: t.id,
      type: "tarefa",
      case_id: t.case_id,
      case_code: map.get(t.case_id)?.case_code ?? "—",
      client_name: map.get(t.case_id)?.client_name ?? "—",
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee_id: t.assignee_id,
      assignee_name: t.assignee_id ? (userMap.get(t.assignee_id) ?? null) : null,
      due_date: t.due_date,
      stage_slug: null,
    });
  }
  for (const c of chk ?? []) {
    const row = c as {
      id: string;
      case_id: string;
      assigned_to: string | null;
      stage_slug: string | null;
      label: string | null;
      def?: { label?: string } | null;
    };
    items.push({
      id: row.id,
      type: "checklist",
      case_id: row.case_id,
      case_code: map.get(row.case_id)?.case_code ?? "—",
      client_name: map.get(row.case_id)?.client_name ?? "—",
      title: row.def?.label ?? row.label ?? "Item de checklist",
      status: "PENDENTE",
      priority: null,
      assignee_id: row.assigned_to,
      assignee_name: row.assigned_to ? (userMap.get(row.assigned_to) ?? null) : null,
      due_date: null,
      stage_slug: row.stage_slug,
    });
  }

  let out = items;
  if (filters?.status) out = out.filter((i) => i.status === filters.status);
  const q = (filters?.search ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.case_code.toLowerCase().includes(q) ||
        i.client_name.toLowerCase().includes(q),
    );
  }
  return { items: out, canSeeAll };
}

export async function listAllDeadlines() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_deadlines")
    .select("id, case_id, title, tipo, fatal_date, recommended_date, status, responsible")
    .is("deleted_at", null)
    .order("fatal_date", { ascending: true });
  check(error);
  const map = await caseLookup(sb);
  return (data ?? []).map((d) => ({
    ...d,
    case_code: map.get(d.case_id)?.case_code ?? "—",
    client_name: map.get(d.case_id)?.client_name ?? "—",
  }));
}
