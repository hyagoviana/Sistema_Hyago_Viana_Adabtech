// Server-only — CRUD do dossiê do caso (tarefas, prazos, comunicações).
// NUNCA importe este arquivo em código que roda no browser.
import { seesOnlyOwnCases, type Role } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";
import {
  isTaskAberta,
  isTaskConcluida,
  TASK_STATUSES,
  taskStatusLabel,
} from "./task-status-shared";
import { getUserRole } from "./users-service";
import { espelharSituacaoDaTarefa, type EspelhoResultado } from "./projuris/espelhar-situacao";

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
    assignee_name:
      (t.assigned_user as { id: string; full_name: string } | null)?.full_name ??
      t.assignee ??
      null,
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
    // Tipo vindo do catálogo único do sistema (doc 21.08). Opcional.
    task_type_id?: string | null;
    // W1 — qual regra de workflow criou esta tarefa (NULL = criada por gente).
    created_by_workflow_id?: string | null;
    // Doc 31.08 — indice da ACAO da regra que criou (caminho de volta do
    // encadeamento "quando esta tarefa fechar, faca X").
    created_by_workflow_action?: number | null;
  },
  triggeredBy?: string,
  // W1 — código do workflow, só para carimbar o evento da linha do tempo. Fica
  // fora do `input` de propósito: não é coluna da tarefa, é rastro de exibição.
  workflowCode?: string | null,
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
      diff: {
        task_title: input.title,
        assignee_id: input.assignee_id ?? null,
        ...(workflowCode ? { workflow_code: workflowCode } : {}),
      },
      triggered_by: triggeredBy ?? null,
    });
  }

  return data;
}

export async function setCaseTaskStatus(id: string, status: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  // TK1 — CONCLUIDA_SUCESSO e CONCLUIDA_SEM_SUCESSO fecham a tarefa (as duas
  // carimbam completed_at). CANCELADA não é conclusão: fica sem carimbo.
  const { data, error } = await sb
    .from("system_case_tasks")
    .update({ status, completed_at: isTaskConcluida(status) ? now() : null })
    .eq("id", id)
    .select()
    .single();
  check(error);

  // Registra evento na timeline do caso para qualquer mudança de status
  if (data) {
    const action = isTaskConcluida(status)
      ? "task_completed"
      : status === "EM_ANDAMENTO"
        ? "task_started"
        : "task_status_changed";
    await sb.from("system_case_events").insert({
      case_id: data.case_id,
      organization_id: DEFAULT_ORG_ID,
      action,
      // `status` cru vai no diff (a tela traduz com taskStatusLabel); `status_label`
      // guarda a leitura humana do momento — o "sem sucesso" precisa aparecer na
      // linha do tempo, senão vira só "tarefa concluída" e perde a informação.
      diff: { task_title: data.title, task_id: id, status, status_label: taskStatusLabel(status) },
      triggered_by: triggeredBy ?? null,
    });
  }

  // Espelho no ProJuris (2026-08-27) — "concluir aqui reflete lá".
  // Vem DEPOIS do update local de propósito: a conclusão no SHV é o que vale e
  // não pode falhar porque o ProJuris está fora do ar. Best-effort, e devolve o
  // motivo quando não vai — inclusive o mais comum, que nem é erro:
  // "tarefa só existe no SHV".
  if (!data) return data;

  const espelho: EspelhoResultado = await espelharSituacaoDaTarefa(id).catch((err) => ({
    espelhado: false as const,
    motivo: err instanceof Error ? err.message : String(err),
  }));

  return { ...data, espelho };
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
    const action =
      status === "CUMPRIDO"
        ? "deadline_completed"
        : status === "PERDIDO"
          ? "deadline_missed"
          : "deadline_status_changed";
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
      diff: {
        summary: input.summary,
        channel: input.channel ?? "OUTRO",
        direction: input.direction ?? "OUT",
      },
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
  // `tema_id` entrou no doc 31.08: a tela de Tarefas filtra por TEMA, e o tema
  // é do caso, não da tarefa.
  const { data } = await sb
    .from("system_cases_active")
    .select("id, case_code, client_name, tema_id");
  const map = new Map<string, { case_code: string; client_name: string; tema_id: string | null }>();
  (data ?? []).forEach((c) =>
    map.set(c.id, {
      case_code: c.case_code,
      client_name: c.client_name,
      tema_id: (c as { tema_id?: string | null }).tema_id ?? null,
    }),
  );
  return map;
}

// ----------------------------------------------------------------------------
// Doc 31.08 (Thiago) — a data que aparece no CARD do kanban passa a ser a das
// TAREFAS, não mais "dias parado na etapa":
//
//   "Se não existir tarefa = sem prazo = sem contagem visual aqui.
//    Se existir tarefa em prazo  = mostrar quantos dias faltam até o vencimento.
//    Se existir tarefa em atraso = mostrar quantos dias se passaram do vencimento."
//
// Anexa `task_due_date` = o MENOR due_date entre as tarefas ABERTAS do caso (a
// mais urgente, ou a mais atrasada — a mesma que a pessoa precisa olhar primeiro).
// NULL quando o caso não tem tarefa aberta com prazo: o card fica sem selo, e
// isso é o estado normal de um caso em dia ("é normal um caso não ter datas").
// ----------------------------------------------------------------------------
export async function attachOpenTaskDueDate<T extends { id: string }>(
  rows: T[],
): Promise<(T & { task_due_date: string | null })[]> {
  if (rows.length === 0) return [];
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_case_tasks")
    .select("case_id, due_date")
    .is("deleted_at", null)
    .not("due_date", "is", null)
    .in("status", TASK_STATUSES.filter(isTaskAberta))
    .in(
      "case_id",
      rows.map((r) => r.id),
    );

  const menor = new Map<string, string>();
  for (const t of data ?? []) {
    const atual = menor.get(t.case_id);
    // Datas ISO (YYYY-MM-DD) comparam bem como string.
    if (!atual || (t.due_date as string) < atual) menor.set(t.case_id, t.due_date as string);
  }
  return rows.map((r) => ({ ...r, task_due_date: menor.get(r.id) ?? null }));
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
    case_code: map.get(t.case_id)?.case_code ?? "·",
    client_name: map.get(t.case_id)?.client_name ?? "·",
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
  // Doc 31.08 — o que a tela de Tarefas passou a filtrar e ordenar.
  created_at: string | null;
  task_type_id: string | null;
  task_type_name: string | null;
  tema_id: string | null;
};

const PRIORIDADE_PESO: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };

/**
 * Ordem canônica da lista de tarefas (doc 31.08, Thiago):
 *
 *   "Data de execução mais próxima > data de execução mais distante.
 *    SE mesma data de execução = maior prioridade > menor prioridade.
 *    SE mesma data e prioridade = data de criação mais próxima > mais distante."
 *
 * Tarefa sem prazo vai para o FIM: ela não disputa urgência com quem tem data.
 * O desempate final por id é o que impede a lista de oscilar entre requisições
 * (mesmo problema que embaralhava as colunas do kanban).
 */
export function ordenarWorkItems(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => {
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    const pa = PRIORIDADE_PESO[a.priority ?? "MEDIA"] ?? 9;
    const pb = PRIORIDADE_PESO[b.priority ?? "MEDIA"] ?? 9;
    if (pa !== pb) return pa - pb;
    const ca = a.created_at ?? "";
    const cb = b.created_at ?? "";
    if (ca !== cb) return ca > cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export async function listWorkItems(
  viewerId: string,
  filters?: {
    assigneeId?: string | null;
    caseId?: string | null;
    status?: string | null;
    search?: string | null;
    // Doc 31.08 — filtros novos da tela de Tarefas.
    temaId?: string | null;
    taskTypeId?: string | null;
    priority?: string | null;
    /**
     * Doc 31.08: "remover visualização unificada de checklist / tarefas daqui.
     * Checklists permanecem apenas na página do caso." Por isso o padrão é
     * FALSE — a agregação continua sabendo juntar os dois, mas quem quiser os
     * itens de checklist precisa pedir explicitamente.
     */
    incluirChecklist?: boolean;
  },
): Promise<{ items: WorkItem[]; canSeeAll: boolean }> {
  const sb = getSupabaseAdmin();
  const role = await getUserRole(viewerId);
  // Papéis que só veem os próprios casos → escopo travado em si mesmo.
  const canSeeAll = !seesOnlyOwnCases((role ?? "") as Role);
  const scopeAssignee = canSeeAll ? filters?.assigneeId || null : viewerId;
  const incluirChecklist = filters?.incluirChecklist ?? false;

  // Tarefas ABERTAS. TK1: aberta = nem concluída (com/sem sucesso) nem cancelada.
  // A lista sai do domínio compartilhado, então um status novo no futuro não
  // exige caçar comparação de string espalhada pelo código.
  let tq = sb
    .from("system_case_tasks")
    .select("id, case_id, title, status, priority, assignee_id, due_date, created_at, task_type_id")
    .is("deleted_at", null)
    .in("status", TASK_STATUSES.filter(isTaskAberta));
  if (scopeAssignee) tq = tq.eq("assignee_id", scopeAssignee);
  if (filters?.caseId) tq = tq.eq("case_id", filters.caseId);
  if (filters?.taskTypeId) tq = tq.eq("task_type_id", filters.taskTypeId);
  if (filters?.priority) tq = tq.eq("priority", filters.priority);
  const { data: tasks } = await tq;

  // Itens de checklist pendentes (só quando pedidos — ver incluirChecklist).
  const chkSelect =
    "id, case_id, assigned_to, stage_slug, label, done, created_at, def:system_stage_checklist_defs(label)";
  let chk: unknown[] = [];
  if (incluirChecklist && scopeAssignee) {
    // Considera tanto o assigned_to (primário) quanto a N:N (responsável 2b).
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
  } else if (incluirChecklist) {
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

  // Nome do tipo de tarefa (catálogo único do sistema) — a tela mostra e filtra.
  const tipoIds = [
    ...new Set((tasks ?? []).map((t) => t.task_type_id).filter(Boolean) as string[]),
  ];
  const { data: tipos } = tipoIds.length
    ? await sb
        .from("system_task_type_mapping")
        .select("id, projuris_tipo_descricao, projuris_tipo_codigo")
        .in("id", tipoIds)
    : {
        data: [] as {
          id: string;
          projuris_tipo_descricao: string;
          projuris_tipo_codigo: string;
        }[],
      };
  const tipoMap = new Map(
    (tipos ?? []).map((t) => [t.id, t.projuris_tipo_descricao || t.projuris_tipo_codigo]),
  );

  const items: WorkItem[] = [];
  for (const t of tasks ?? []) {
    const caso = map.get(t.case_id);
    items.push({
      id: t.id,
      type: "tarefa",
      case_id: t.case_id,
      case_code: caso?.case_code ?? "·",
      client_name: caso?.client_name ?? "·",
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee_id: t.assignee_id,
      assignee_name: t.assignee_id ? (userMap.get(t.assignee_id) ?? null) : null,
      due_date: t.due_date,
      stage_slug: null,
      created_at: t.created_at,
      task_type_id: t.task_type_id ?? null,
      task_type_name: t.task_type_id ? (tipoMap.get(t.task_type_id) ?? null) : null,
      tema_id: caso?.tema_id ?? null,
    });
  }
  for (const c of chk ?? []) {
    const row = c as {
      id: string;
      case_id: string;
      assigned_to: string | null;
      stage_slug: string | null;
      label: string | null;
      created_at?: string | null;
      def?: { label?: string } | null;
    };
    const caso = map.get(row.case_id);
    items.push({
      id: row.id,
      type: "checklist",
      case_id: row.case_id,
      case_code: caso?.case_code ?? "·",
      client_name: caso?.client_name ?? "·",
      title: row.def?.label ?? row.label ?? "Item de checklist",
      // Item de checklist não tem ciclo próprio: enquanto aparece aqui, está aberto.
      status: "EM_ANDAMENTO",
      priority: null,
      assignee_id: row.assigned_to,
      assignee_name: row.assigned_to ? (userMap.get(row.assigned_to) ?? null) : null,
      due_date: null,
      stage_slug: row.stage_slug,
      created_at: row.created_at ?? null,
      task_type_id: null,
      task_type_name: null,
      tema_id: caso?.tema_id ?? null,
    });
  }

  let out = items;
  if (filters?.status) out = out.filter((i) => i.status === filters.status);
  // Tema é do CASO, não da tarefa — por isso o filtro é aplicado aqui, depois
  // do enriquecimento, e não como .eq() na consulta das tarefas.
  if (filters?.temaId) out = out.filter((i) => i.tema_id === filters.temaId);
  const q = (filters?.search ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.case_code.toLowerCase().includes(q) ||
        i.client_name.toLowerCase().includes(q),
    );
  }
  return { items: ordenarWorkItems(out), canSeeAll };
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
    case_code: map.get(d.case_id)?.case_code ?? "·",
    client_name: map.get(d.case_id)?.client_name ?? "·",
  }));
}
