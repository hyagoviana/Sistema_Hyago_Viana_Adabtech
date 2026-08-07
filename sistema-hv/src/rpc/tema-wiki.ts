// RPC — C5: "Links úteis" / wiki por TEMA.
// Leitura: qualquer autenticado (requireAuth). Escrita (criar/editar/reordenar/
// excluir bloco) = módulo `sistema` edit (config admin) — mesmo gate dos boards.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createTemaWikiBlock,
  listTemaWikiBlocks,
  reorderTemaWikiBlocks,
  softDeleteTemaWikiBlock,
  updateTemaWikiBlock,
} from "@/lib/tema-wiki-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";

function run<T>(
  guard: () => Promise<{ id: string }>,
  fn: (userId: string) => Promise<T>,
): Promise<T> {
  return (async () => {
    try {
      const { id: userId } = await guard();
      return await fn(userId);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      const status = (err as { status?: number })?.status;
      setResponseStatus(typeof status === "number" ? status : 500);
      throw err instanceof Error ? new Error(err.message) : err;
    }
  })();
}

const handle = <T>(fn: (userId: string) => Promise<T>) => run(() => requireAuth(), fn);
const handleSistema = <T>(fn: (userId: string) => Promise<T>) =>
  run(() => requireModule("sistema", "edit"), fn);

// Shape de item aceito na entrada (o service revalida + gera id estável).
const itemSchema = z.object({
  id: z.string().optional(),
  tipo: z.enum(["texto", "link"]),
  valor: z.string(),
  rotulo: z.string().optional(),
});

// ------------------------------------------------------------------- Read
export const listTemaWikiBlocksFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ temaId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listTemaWikiBlocks(data.temaId)));

// ------------------------------------------------------------------- Writes
export const createTemaWikiBlockFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temaId: z.string().uuid(),
        titulo: z.string().min(1),
        itens: z.array(itemSchema).optional(),
        ordem: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handleSistema((userId) =>
      createTemaWikiBlock({
        tema_id: data.temaId,
        titulo: data.titulo,
        itens: data.itens,
        ordem: data.ordem,
        createdBy: userId,
      }),
    ),
  );

export const updateTemaWikiBlockFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          titulo: z.string().min(1).optional(),
          itens: z.array(itemSchema).optional(),
          ordem: z.number().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleSistema(() => updateTemaWikiBlock(data.id, data.patch)));

export const reorderTemaWikiBlocksFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data }) => handleSistema(() => reorderTemaWikiBlocks(data.ids)));

export const deleteTemaWikiBlockFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleSistema(() => softDeleteTemaWikiBlock(data.id)));
