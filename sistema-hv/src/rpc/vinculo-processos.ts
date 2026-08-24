// RPC (server-only) — vínculo entre o caso do SHV e o processo do ProJuris.
// Gate: controladoria (view para conferir, edit para vincular/desfazer).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import {
  desvincularCaso,
  esquecerProcessos,
  listCasosSemProcesso,
  vincularCasoAoProcesso,
} from "@/lib/distribuicao/vinculo-processos";
import type { CasoSemProcesso } from "@/lib/distribuicao/vinculo-processos";

export type { CasoSemProcesso };

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? new Error(err.message) : new Error(String(err));
  }
}

export const listCasosSemProcessoFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<CasoSemProcesso[]> => {
    await requireModule("controladoria", "view");
    return listCasosSemProcesso();
  }),
);

/** Botão "Atualizar do ProJuris": joga fora o cache e recarrega a listagem. */
export const recarregarProcessosFn = createServerFn({ method: "POST" }).handler(async () =>
  handle(async (): Promise<CasoSemProcesso[]> => {
    await requireModule("controladoria", "edit");
    esquecerProcessos();
    return listCasosSemProcesso();
  }),
);

export const vincularCasoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ casoId: z.string().uuid(), codigoProcesso: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("controladoria", "edit");
      return vincularCasoAoProcesso(data.casoId, data.codigoProcesso);
    }),
  );

export const desvincularCasoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ casoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("controladoria", "edit");
      await desvincularCaso(data.casoId);
    }),
  );
