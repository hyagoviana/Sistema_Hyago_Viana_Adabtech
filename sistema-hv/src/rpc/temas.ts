import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createFrente,
  createTema,
  deleteFrente,
  deleteTema,
  ensureTemaFolder,
  getTemaServiceType,
  linkTemaFolder,
  listFrentes,
  listTemas,
  listTemasRootFolders,
  updateFrente,
  updateTema,
} from "@/lib/tema-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";

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

// Escrita (sensível): criar, renomear, excluir tema e vincular pasta é mudar a
// RÉGUA do escritório, não operar um caso. Por isso o gate é o nível
// **Configurar** do módulo Sistema.
//
// S5-04 — fecha o TODO(R3) que estava aqui: era `requireRole(["admin"])`, um
// papel cravado no código que ignorava a matriz. Com `requireModule` a régua
// passa a ser configurável: hoje só o Administrador tem Configurar em Sistema,
// e delegar para outro papel vira ajuste de permissão, não alteração de código.
async function handleAdmin<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireModule("sistema", "configure");
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

// T2 (2026-07-19) — cria/garante a pasta-raiz do tema no Drive (idempotente).
// Admin-only. Usado pelo botão "Criar pasta do tema" dos temas ainda sem pasta.
export const ensureTemaFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ temaId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleAdmin(() => ensureTemaFolder(data.temaId)));

// Lista as pastas dentro da raiz "tema" (1PtxXw) — para o admin escolher qual é a
// pasta de um tema (vincular a que ele já criou). Admin-only.
export const listTemasRootFoldersFn = createServerFn({ method: "GET" }).handler(async () =>
  handleAdmin(() => listTemasRootFolders()),
);

// Vincula ao tema uma pasta existente do Drive (escolhida na UI). Admin-only.
export const linkTemaFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ temaId: z.string().uuid(), driveFolderId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => handleAdmin(() => linkTemaFolder(data.temaId, data.driveFolderId)));

// R2-04 — service_type INTERNO (motor) do tema. Usado pelo editor de vínculo de
// pastas por frente (as pastas são gravadas nesse service_type + frente_slug).
export const getTemaServiceTypeFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ temaId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      const st = await getTemaServiceType(data.temaId);
      return st ? { id: st.id as string } : null;
    }),
  );

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
