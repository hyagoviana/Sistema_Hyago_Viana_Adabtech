import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { getUserModulePerms, setUserModulePerms } from "@/lib/rbac-perms-service";
import { MODULES, type Module, type ModuleAccess } from "@/lib/rbac";
import { AuthError, requireAuth, requireRole } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

/**
 * Overrides de módulo do usuário LOGADO (R3-01, AC-5). Sem override configurado
 * ⇒ `{}` (o front cai no papel via `permissaoEfetiva`). Consumido pelas stories
 * R3-02/R3-04/R3-05.
 */
export const getMyModulePermsFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<Partial<Record<Module, ModuleAccess>>> => {
    const { id } = await requireAuth();
    return getUserModulePerms(id);
  }),
);

// ADMIN — lê os overrides de um usuário QUALQUER (para editar na tela de
// permissões / no convite). Gate: só admin (requireRole).
export const getUserModulePermsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<Partial<Record<Module, ModuleAccess>>> => {
      await requireRole(["admin"]);
      return getUserModulePerms(data.userId);
    }),
  );

// ADMIN — grava os overrides por módulo de um usuário. `null` num módulo remove o
// override (volta ao padrão do papel). Gate: só admin.
const setPermsSchema = z.object({
  userId: z.string().uuid(),
  perms: z.record(
    z.enum(MODULES),
    z.enum(["none", "view", "edit"]).nullable(),
  ),
});

export const setUserModulePermsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setPermsSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<{ ok: true }> => {
      await requireRole(["admin"]);
      await setUserModulePerms(
        data.userId,
        data.perms as Partial<Record<Module, ModuleAccess | null>>,
      );
      return { ok: true };
    }),
  );
