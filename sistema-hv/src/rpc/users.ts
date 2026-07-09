import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import {
  UsersServiceError,
  listUsers,
  inviteUser,
  activateUser,
  getMyProfile,
  getUserReport,
  getUserRole,
  setUserRole,
  setUserStatus,
  removeUser,
  requestPasswordReset,
  updateUserPassword,
  updateUserProfile,
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

// Perfil do próprio usuário autenticado (para editar nome/telefone).
export const getMyProfileFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async () => {
    const me = await requireAuth();
    return getMyProfile(me.id);
  }),
);

export const inviteUserFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { email: string; full_name?: string; role: string; redirectTo?: string }) => d,
  )
  .handler(async ({ data }) => handle(() => inviteUser(data)));

// Ativa o próprio usuário autenticado após ele definir a senha (convite aceito).
export const activateUserFn = createServerFn({ method: "POST" }).handler(async () =>
  handle(async () => {
    const me = await requireAuth();
    return activateUser(me.id);
  }),
);

// Edita nome/telefone de um usuário. Autorização: o PRÓPRIO usuário ou um admin.
export const updateUserProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; full_name?: string | null; phone?: string | null }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      const targetId = data.id ?? me.id;
      if (targetId !== me.id) {
        const myRole = await getUserRole(me.id);
        if (myRole !== "admin") {
          throw new UsersServiceError("Sem permissão para editar outro usuário.", 403);
        }
      }
      return updateUserProfile(targetId, { full_name: data.full_name, phone: data.phone });
    }),
  );

// Relatório de tudo vinculado a um usuário. Autorização: admin ou o próprio.
export const getUserReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      if (data.userId !== me.id) {
        const myRole = await getUserRole(me.id);
        if (myRole !== "admin") {
          throw new UsersServiceError("Sem permissão para ver este usuário.", 403);
        }
      }
      return getUserReport(data.userId);
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
