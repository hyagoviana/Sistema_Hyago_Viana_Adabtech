// RPC (server-only) — vínculo entre o caso do SHV e os processos do ProJuris.
// Gate: controladoria (view para conferir, edit para vincular/desfazer).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import {
  buscarProcessoPorNumero,
  definirPrincipal,
  desvincularProcesso,
  esquecerProcessos,
  listCasosComProcessos,
  vincularProcesso,
} from "@/lib/distribuicao/vinculo-processos";
import type { CasoComProcessos, ProcessoCandidato } from "@/lib/distribuicao/vinculo-processos";

export type { CasoComProcessos, ProcessoCandidato };

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

export const listCasosComProcessosFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ somentePendentes: z.boolean().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<CasoComProcessos[]> => {
      await requireModule("controladoria", "view");
      return listCasosComProcessos(data?.somentePendentes ?? true);
    }),
  );

/** Botão "Atualizar do ProJuris": joga fora o cache e recarrega a listagem. */
export const recarregarProcessosFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ somentePendentes: z.boolean().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<CasoComProcessos[]> => {
      await requireModule("controladoria", "edit");
      esquecerProcessos();
      return listCasosComProcessos(data?.somentePendentes ?? true);
    }),
  );

/** Busca por número do processo (CNJ ou PRO.xxxx) — ou pelo nome do cliente. */
export const buscarProcessoFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ termo: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<ProcessoCandidato[]> => {
      await requireModule("controladoria", "view");
      return buscarProcessoPorNumero(data.termo);
    }),
  );

export const vincularProcessoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        casoId: z.string().uuid(),
        codigoProcesso: z.number().int().positive(),
        principal: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("controladoria", "edit");
      return vincularProcesso(data.casoId, data.codigoProcesso, {
        principal: data.principal,
        userId,
      });
    }),
  );

export const desvincularProcessoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ casoId: z.string().uuid(), codigoProcesso: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("controladoria", "edit");
      await desvincularProcesso(data.casoId, data.codigoProcesso);
    }),
  );

export const definirPrincipalFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ casoId: z.string().uuid(), codigoProcesso: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("controladoria", "edit");
      await definirPrincipal(data.casoId, data.codigoProcesso);
    }),
  );
