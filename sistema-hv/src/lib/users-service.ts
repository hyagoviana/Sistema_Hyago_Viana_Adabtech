// Server-only — gestão de usuários do sistema (RBAC) e consentimento (LGPD).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
import { ROLES, type Role } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

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
export async function inviteUser(input: { email: string; full_name?: string; role: string }) {
  assertRole(input.role);
  const sb = getSupabaseAdmin();

  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name ?? null },
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
