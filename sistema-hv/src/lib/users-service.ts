// Server-only — gestão de usuários do sistema (RBAC) e consentimento (LGPD).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
import { ROLES, type Role } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// URL pública do app — usada para montar o link dos e-mails de convite/reset.
// Em produção (Vercel) configure APP_URL; o fallback é o domínio oficial.
const APP_URL = (process.env.APP_URL ?? "https://www.sistemahyagoviana.com.br").replace(/\/+$/, "");

export class UsersServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "UsersServiceError";
  }
}

function check(error: { message: string } | null) {
  if (error) throw new UsersServiceError(error.message, 500);
}

function assertRole(role: string): asserts role is Role {
  if (!ROLES.includes(role as Role)) {
    throw new UsersServiceError(`Papel inválido: ${role}`, 400);
  }
}

const now = () => new Date().toISOString();

// ----------------------------------------------------------------------------
// Usuários
// ----------------------------------------------------------------------------
export async function listUsers() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users_active")
    .select("id, email, full_name, phone, role, status, created_at")
    .order("created_at", { ascending: true });
  check(error);
  return data ?? [];
}

/**
 * Edita dados de perfil de um usuário (nome e telefone). Chamado tanto pelo
 * próprio usuário quanto pelo admin — a autorização é feita no RPC.
 */
export async function updateUserProfile(
  id: string,
  patch: { full_name?: string | null; phone?: string | null },
) {
  const sb = getSupabaseAdmin();
  const fields: Record<string, unknown> = {};
  if (patch.full_name !== undefined) fields.full_name = patch.full_name;
  if (patch.phone !== undefined) fields.phone = patch.phone;
  if (Object.keys(fields).length === 0) {
    throw new UsersServiceError("Nada para atualizar.", 400);
  }
  const { data, error } = await sb
    .from("system_users")
    .update(fields as never)
    .eq("id", id)
    .select("id, email, full_name, phone, role, status")
    .single();
  check(error);
  return data;
}

/**
 * Convida um usuário: cria a conta no Supabase Auth (envia e-mail de convite)
 * e registra o perfil em system_users com status INVITED.
 */
export async function inviteUser(input: {
  email: string;
  full_name?: string;
  role: string;
  redirectTo?: string;
}) {
  assertRole(input.role);
  const sb = getSupabaseAdmin();

  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name ?? null },
    redirectTo: input.redirectTo ?? `${APP_URL}/nova-senha`,
  });
  if (inviteErr || !invited?.user) {
    throw new UsersServiceError(inviteErr?.message ?? "Falha ao convidar usuário.", 400);
  }

  const { data, error } = await sb
    .from("system_users")
    .insert({
      id: invited.user.id,
      organization_id: DEFAULT_ORG_ID,
      email: input.email,
      full_name: input.full_name ?? null,
      role: input.role,
      status: "INVITED",
    })
    .select("id, email, full_name, role, status, created_at")
    .single();
  check(error);
  return data;
}

/**
 * Ativa o usuário recém-convidado depois que ele define a senha (INVITED → ACTIVE).
 * O papel (admin/comercial/financeiro/…) já foi gravado no convite e é preservado.
 * Idempotente: se já estiver ACTIVE (ex.: reset de senha), não altera nada.
 */
export async function activateUser(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .update({ status: "ACTIVE" })
    .eq("id", id)
    .eq("status", "INVITED")
    .select("id, email, role, status")
    .maybeSingle();
  check(error);
  return data ?? { id, status: "ACTIVE" as const };
}

/** Perfil do próprio usuário (inclui telefone) — para a tela de configurações. */
export async function getMyProfile(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .select("id, email, full_name, phone, role, status")
    .eq("id", id)
    .maybeSingle();
  check(error);
  return data;
}

// ─── Relatório de tudo que está vinculado a um usuário (item 2026-07-09) ───────
// Casos onde é responsável/criador, tarefas atribuídas e itens de checklist sob
// sua responsabilidade — com destaque para as PENDÊNCIAS.
export type UserReport = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
    status: string;
  } | null;
  casos: Array<{
    case_id: string;
    case_code: string;
    client_name: string;
    case_type: string;
    macrostatus_op: string | null;
    macrostatus_fin: string | null;
    is_responsavel: boolean;
    is_creator: boolean;
  }>;
  tarefas: Array<{
    id: string;
    case_id: string;
    case_code: string;
    client_name: string;
    title: string;
    status: string;
    due_date: string | null;
  }>;
  checklist: Array<{
    id: string;
    case_id: string;
    case_code: string;
    client_name: string;
    label: string;
    stage_slug: string;
    done: boolean;
  }>;
  resumo: { total_casos: number; tarefas_pendentes: number; checklist_pendentes: number };
};

export async function getUserReport(userId: string): Promise<UserReport> {
  const sb = getSupabaseAdmin();

  const user = await getMyProfile(userId);

  const { data: resp } = await sb
    .from("system_case_responsaveis_active")
    .select("case_id")
    .eq("user_id", userId);
  const respIds = new Set((resp ?? []).map((r) => (r as { case_id: string }).case_id));

  const { data: created } = await sb
    .from("system_cases")
    .select("id")
    .eq("created_by", userId)
    .is("deleted_at", null);
  const createdIds = new Set((created ?? []).map((c) => c.id));

  const { data: tasks } = await sb
    .from("system_case_tasks")
    .select("id, case_id, title, status, due_date")
    .eq("assignee_id", userId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  const { data: chk } = await sb
    .from("system_case_checklist_items")
    .select("id, case_id, stage_slug, label, done, def:system_stage_checklist_defs(label)")
    .eq("assigned_to", userId)
    .is("deleted_at", null);

  // Lookup de código do caso + nome do cliente para todas as entidades envolvidas.
  const allCaseIds = [
    ...new Set([
      ...respIds,
      ...createdIds,
      ...(tasks ?? []).map((t) => t.case_id),
      ...(chk ?? []).map((c) => c.case_id),
    ]),
  ];
  const { data: cases } = await sb
    .from("system_cases")
    .select("id, case_code, client_id, case_type, macrostatus_op, macrostatus_fin")
    .in("id", allCaseIds);
  const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
  const clientIds = [...new Set((cases ?? []).map((c) => c.client_id))];
  const { data: clients } = await sb
    .from("system_clients")
    .select("id, full_name")
    .in("id", clientIds);
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
  const nameOf = (caseId: string) => {
    const c = caseMap.get(caseId);
    return {
      case_code: c?.case_code ?? "—",
      client_name: clientMap.get(c?.client_id ?? "") ?? "—",
    };
  };

  const casos = [...new Set([...respIds, ...createdIds])].map((id) => {
    const c = caseMap.get(id);
    return {
      case_id: id,
      ...nameOf(id),
      case_type: c?.case_type ?? "",
      macrostatus_op: c?.macrostatus_op ?? null,
      macrostatus_fin: c?.macrostatus_fin ?? null,
      is_responsavel: respIds.has(id),
      is_creator: createdIds.has(id),
    };
  });

  const tarefas = (tasks ?? []).map((t) => ({
    id: t.id,
    case_id: t.case_id,
    ...nameOf(t.case_id),
    title: t.title,
    status: t.status,
    due_date: t.due_date,
  }));

  const checklist = (chk ?? []).map((it) => ({
    id: it.id,
    case_id: it.case_id,
    ...nameOf(it.case_id),
    label: (it as { def?: { label?: string } | null }).def?.label ?? it.label ?? "—",
    stage_slug: it.stage_slug,
    done: it.done,
  }));

  return {
    user,
    casos,
    tarefas,
    checklist,
    resumo: {
      total_casos: casos.length,
      tarefas_pendentes: tarefas.filter((t) => t.status !== "CONCLUIDA").length,
      checklist_pendentes: checklist.filter((c) => !c.done).length,
    },
  };
}

/** Papel atual de um usuário (para checagens de autorização no RPC). */
export async function getUserRole(id: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("system_users").select("role").eq("id", id).maybeSingle();
  return data?.role ?? null;
}

export async function setUserRole(id: string, role: string) {
  assertRole(role);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .update({ role })
    .eq("id", id)
    .select("id, email, full_name, role, status")
    .single();
  check(error);
  return data;
}

export async function setUserStatus(id: string, status: string) {
  if (!["INVITED", "ACTIVE", "SUSPENDED"].includes(status)) {
    throw new UsersServiceError(`Status inválido: ${status}`, 400);
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .update({ status })
    .eq("id", id)
    .select("id, email, full_name, role, status")
    .single();
  check(error);
  return data;
}

/** Soft-delete: remove o perfil do sistema (a conta Auth permanece). */
export async function removeUser(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_users")
    .update({ deleted_at: now(), status: "SUSPENDED" })
    .eq("id", id);
  check(error);
  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// Senha — reset e alteração
// ----------------------------------------------------------------------------

/**
 * Envia e-mail de recuperação de senha via Supabase Auth.
 * Não requer autenticação (endpoint público).
 */
export async function requestPasswordReset(email: string, redirectTo: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new UsersServiceError(error.message, 400);
  return { ok: true as const };
}

/**
 * Altera a senha de um usuário autenticado.
 * Requer que o chamador passe o userId já validado pelo auth-guard.
 */
export async function updateUserPassword(userId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new UsersServiceError("A senha deve ter no mínimo 6 caracteres.", 400);
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new UsersServiceError(error.message, 400);

  // Ativar usuário convidado que está definindo senha pela primeira vez
  const { data: profile } = await sb
    .from("system_users")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.status === "INVITED") {
    await sb.from("system_users").update({ status: "ACTIVE" }).eq("id", userId);
  }

  return { ok: true as const };
}

// ----------------------------------------------------------------------------
// LGPD — consentimento
// ----------------------------------------------------------------------------
export async function recordConsent(input: {
  client_id?: string | null;
  cpf_cnpj?: string | null;
  finalidade: string;
  channel?: string | null;
  policy_version?: string;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_consent_records")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      client_id: input.client_id ?? null,
      cpf_cnpj: input.cpf_cnpj ?? null,
      finalidade: input.finalidade,
      channel: input.channel ?? "SISTEMA",
      policy_version: input.policy_version ?? "1.0.0",
    })
    .select()
    .single();
  check(error);
  return data;
}

export async function listConsents(clientId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_consent_records")
    .select("*")
    .eq("client_id", clientId)
    .order("granted_at", { ascending: false });
  check(error);
  return data ?? [];
}

export async function revokeConsent(id: string, reason?: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_consent_records")
    .update({ revoked_at: now(), revoke_reason: reason ?? null })
    .eq("id", id)
    .select()
    .single();
  check(error);
  return data;
}
