import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { globalSearch, type SearchResult } from "@/lib/search-service";
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

// Busca global da topbar. Respeita a visibilidade do usuário logado (passa o id
// para o service filtrar casos/clientes por RBAC).
export const globalSearchFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ term: z.string() }).parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<SearchResult[]> => {
      const { id } = await requireAuth();
      return globalSearch(data.term, id);
    }),
  );
