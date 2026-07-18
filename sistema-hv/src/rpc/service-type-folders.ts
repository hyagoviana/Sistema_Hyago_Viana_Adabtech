import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createAndLinkFolder,
  linkExistingFolder,
  listTypeFolders,
  unlinkFolder,
} from "@/lib/service-type-folders-service";
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
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  }
}

const kindSchema = z.enum(["caso", "procuracao"]);

// `frenteSlug` (R2-04, opcional): filtra por frente (frente OU comum). Omisso na
// gestão = todas as pastas; null = caso sem frente (só comuns).
export const listTypeFoldersFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        serviceTypeId: z.string().uuid(),
        kind: kindSchema.optional(),
        frenteSlug: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(() => listTypeFolders(data.serviceTypeId, data.kind, data.frenteSlug)),
  );

// Cria uma pasta NOVA no Drive (sob a raiz correta) e vincula à categoria.
// `frenteSlug` (R2-04): setado = pasta só daquela frente; null/omisso = tema todo.
export const createTypeFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        serviceTypeId: z.string().uuid(),
        kind: kindSchema,
        name: z.string().min(1),
        frenteSlug: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(() =>
      createAndLinkFolder({
        serviceTypeId: data.serviceTypeId,
        kind: data.kind,
        name: data.name,
        frenteSlug: data.frenteSlug ?? null,
      }),
    ),
  );

// Vincula uma pasta EXISTENTE (id do Drive) à categoria.
export const linkTypeFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        serviceTypeId: z.string().uuid(),
        kind: kindSchema,
        driveFolderId: z.string().min(1),
        name: z.string().min(1),
        frenteSlug: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handle(() => linkExistingFolder(data)));

export const unlinkTypeFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => unlinkFolder(data.id)));
