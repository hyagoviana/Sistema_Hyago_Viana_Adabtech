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
    .select("id, email, full_name, role, status, created_at")
    .order("created_at", { ascending: true });
  check(error);
  return data ?? [];
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
