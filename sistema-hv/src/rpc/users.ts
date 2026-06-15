import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import {
  UsersServiceError,
  listUsers,
  inviteUser,
  activateUser,
  setUserRole,
  setUserStatus,
  removeUser,
  requestPasswordReset,
  updateUserPassword,
  recordConsent,
  listConsents,
  revokeConsent,
} from "@/lib/users-service";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireAuth();
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof UsersServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

/** Wrapper para endpoints públicos (sem requireAuth). */
async function handlePublic<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof UsersServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

// -------------------------------------------------------------- Senha ----
export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; redirectTo: string }) => d)
  .handler(async ({ data }) =>
    handlePublic(() => requestPasswordReset(data.email, data.redirectTo)),
  );

export const updatePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((d: { newPassword: string }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const user = await requireAuth();
      return updateUserPassword(user.id, data.newPassword);
    }),
  );

// -------------------------------------------------------------- Usuários ----
export const listUsersFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listUsers()),
);

export const inviteUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; full_name?: string; role: string; redirectTo?: string }) => d)
  .handler(async ({ data }) => handle(() => inviteUser(data)));

// Ativa o próprio usuário autenticado após ele definir a senha (convite aceito).
export const activateUserFn = createServerFn({ method: "POST" }).handler(async () =>
  handle(async () => {
    const me = await requireAuth();
    return activateUser(me.id);
  }),
);

export const setUserRoleFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; role: string }) => d)
  .handler(async ({ data }) => handle(() => setUserRole(data.id, data.role)));

export const setUserStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => handle(() => setUserStatus(data.id, data.status)));

export const removeUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handle(() => removeUser(data.id)));

// ------------------------------------------------------------- LGPD ----
export const recordConsentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      client_id?: string | null;
      cpf_cnpj?: string | null;
      finalidade: string;
      channel?: string | null;
      policy_version?: string;
    }) => d,
  )
  .handler(async ({ data }) => handle(() => recordConsent(data)));

export const listConsentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { clientId: string }) => d)
  .handler(async ({ data }) => handle(() => listConsents(data.clientId)));

export const revokeConsentFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; reason?: string }) => d)
  .handler(async ({ data }) => handle(() => revokeConsent(data.id, data.reason)));
