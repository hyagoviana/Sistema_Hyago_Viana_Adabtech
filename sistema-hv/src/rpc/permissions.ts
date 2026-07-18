import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { getUserModulePerms } from "@/lib/rbac-perms-service";
import type { Module, ModuleAccess } from "@/lib/rbac";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";

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
