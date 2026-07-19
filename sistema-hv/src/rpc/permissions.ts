import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  getUserModulePerms,
  getUserModuleValues,
  setUserModulePerms,
} from "@/lib/rbac-perms-service";
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

// Fase B — overrides da chave "ver valores" do usuário LOGADO.
export const getMyModuleValuesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<Partial<Record<Module, boolean>>> => {
    const { id } = await requireAuth();
    return getUserModuleValues(id);
  }),
);

export type AdminUserPerms = {
  access: Partial<Record<Module, ModuleAccess>>;
  values: Partial<Record<Module, boolean>>;
};

// ADMIN — lê os overrides (acesso + chave de valores) de um usuário QUALQUER
// (para editar na tela de permissões / no convite). Gate: só admin.
export const getUserModulePermsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<AdminUserPerms> => {
      await requireRole(["admin"]);
      const [access, values] = await Promise.all([
        getUserModulePerms(data.userId),
        getUserModuleValues(data.userId),
      ]);
      return { access, values };
    }),
  );

// ADMIN — grava os overrides por módulo de um usuário: `access` (none/view/edit ou
// null=padrão) e `values` (chave "ver valores": true/false ou null=padrão). Gate:
// só admin.
const setPermsSchema = z.object({
  userId: z.string().uuid(),
  access: z.record(z.enum(MODULES), z.enum(["none", "view", "edit"]).nullable()).optional(),
  values: z.record(z.enum(MODULES), z.boolean().nullable()).optional(),
});

export const setUserModulePermsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setPermsSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<{ ok: true }> => {
      await requireRole(["admin"]);
      await setUserModulePerms(data.userId, {
        access: data.access as Partial<Record<Module, ModuleAccess | null>> | undefined,
        values: data.values as Partial<Record<Module, boolean | null>> | undefined,
      });
      return { ok: true };
    }),
  );
