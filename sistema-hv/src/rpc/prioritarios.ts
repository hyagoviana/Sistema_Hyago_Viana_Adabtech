// RPC (server-only) — S6-01: casos prioritários da controladoria.
// Leitura gate-ada pelo módulo `controladoria` (view). A visibilidade por
// usuário (advogado vê só os casos dele) é aplicada dentro do serviço.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { listCasosPrioritarios, type PrioritarioRow } from "@/lib/prioritarios-service";

export type { PrioritarioRow } from "@/lib/prioritarios-service";

export const listCasosPrioritariosFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PrioritarioRow[]> => {
    try {
      const user = await requireModule("controladoria", "view");
      return await listCasosPrioritarios(user.id);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  },
);
