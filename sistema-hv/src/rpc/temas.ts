import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createFrente,
  createTema,
  deleteFrente,
  deleteTema,
  listFrentes,
  listTemas,
  updateFrente,
  updateTema,
} from "@/lib/tema-service";
import { AuthError, requireAuth, requireRole } from "@/lib/supabase/auth-guard";

// Leitura (não sensível): exige apenas autenticação.
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

// Escrita (sensível): gate ADMIN server-side. config.manage é admin-only no rbac,
// então exigimos o papel `admin` explicitamente aqui.
// TODO(R3): migrar para requireModule("sistema", "edit") (permissaoEfetiva) quando
// R3-03 padronizar os gates por módulo — o cruzamento está previsto na story
// (Dependências › Cruzamento com R3).
async function handleAdmin<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireRole(["admin"]);
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

// ------------------------------------------------------------------- Temas
export const listTemasFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listTemas()),
);

export const createTemaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1),
        slug: z.string().optional(),
        ordem: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleAdmin(() => createTema(data)));

export const updateTemaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          name: z.string().min(1).optional(),
          ordem: z.number().optional(),
          active: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleAdmin(() => updateTema(data.id, data.patch)));

export const deleteTemaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleAdmin(() => deleteTema(data.id)));

// ------------------------------------------------------------------- Frentes
export const listFrentesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ temaId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listFrentes(data.temaId)));

export const createFrenteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temaId: z.string().uuid(),
        label: z.string().min(1),
        slug: z.string().optional(),
        ordem: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleAdmin(() => createFrente(data)));

export const updateFrenteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          label: z.string().min(1).optional(),
          ordem: z.number().optional(),
          active: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleAdmin(() => updateFrente(data.id, data.patch)));

export const deleteFrenteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleAdmin(() => deleteFrente(data.id)));
