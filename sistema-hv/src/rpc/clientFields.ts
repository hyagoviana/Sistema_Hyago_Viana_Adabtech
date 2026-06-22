import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createFieldDef,
  deleteFieldDef,
  FieldDefServiceError,
  listFieldDefs,
  reorderFieldDefs,
  setFieldActive,
  updateFieldDef,
} from "@/lib/client-fields-service";
import { AuthError, requireAuth, requireRole } from "@/lib/supabase/auth-guard";
import {
  fieldDefCreateSchema,
  fieldDefUpdateSchema,
  reorderSchema,
} from "@/lib/validators/clientFields";

const idSchema = z.object({ id: z.string().uuid("ID inválido") });

// Só admin gerencia as definições (config.manage é exclusiva do admin).
const ADMIN_ONLY = ["admin"] as const;

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof FieldDefServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Query — leitura liberada a qualquer autenticado (o formulário precisa dela).
// ----------------------------------------------------------------------------
export const listClientFieldDefsFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async () => {
    await requireAuth();
    return listFieldDefs();
  }),
);

// ----------------------------------------------------------------------------
// Mutations — admin only.
// ----------------------------------------------------------------------------
export const createClientFieldDefFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => fieldDefCreateSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireRole(ADMIN_ONLY);
      return createFieldDef(data, me.id);
    }),
  );

const updateInputSchema = z.object({
  id: z.string().uuid("ID inválido"),
  input: fieldDefUpdateSchema,
});

export const updateClientFieldDefFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInputSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return updateFieldDef(data.id, data.input);
    }),
  );

export const deleteClientFieldDefFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return deleteFieldDef(data.id);
    }),
  );

const setActiveSchema = z.object({ id: z.string().uuid("ID inválido"), active: z.boolean() });

export const setClientFieldActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setActiveSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return setFieldActive(data.id, data.active);
    }),
  );

export const reorderClientFieldDefsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reorderSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return reorderFieldDefs(data.ids);
    }),
  );
