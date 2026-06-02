import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import {
  UsersServiceError,
  listUsers,
  inviteUser,
  setUserRole,
  setUserStatus,
  removeUser,
  recordConsent,
  listConsents,
  revokeConsent,
} from "@/lib/users-service";

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    if (err instanceof UsersServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  });
}

// -------------------------------------------------------------- Usuários ----
export const listUsersFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listUsers()),
);

export const inviteUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; full_name?: string; role: string }) => d)
  .handler(async ({ data }) => handle(() => inviteUser(data)));

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
