import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createFieldDef,
  deleteFieldDef,
  FieldDefServiceError,
  listClientFieldTemaLinks,
  listFieldDefs,
  reconcileClientFieldTemaLinks,
  reorderFieldDefs,
  setFieldActive,
  updateFieldDef,
} from "@/lib/client-fields-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";
import { TemaFieldDefServiceError } from "@/lib/tema-field-defs-service";
import {
  fieldDefCreateSchema,
  fieldDefUpdateSchema,
  reorderSchema,
  setClientFieldTemaLinksSchema,
} from "@/lib/validators/clientFields";

const idSchema = z.object({ id: z.string().uuid("ID inválido") });

// B3 / I3 (reunião 2026-08-05) — gerir as DEFINIÇÕES de campo exige `sistema:edit`
// (config.manage). Hoje é do admin, então EQUIVALENTE ao antigo `requireRole
// (["admin"])`, mas passa a honrar overrides por usuário (system_user_module_perms).
// A LEITURA (listClientFieldDefsFn) permanece `requireAuth` — o formulário precisa.

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
    // B1 — reconcile pode propagar erro do serviço de defs de tema (ex.: 409 de
    // colisão de conceito no balde compartilhado do cliente).
    if (err instanceof TemaFieldDefServiceError) {
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
      const me = await requireModule("sistema", "edit");
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
      await requireModule("sistema", "edit");
      return updateFieldDef(data.id, data.input);
    }),
  );

export const deleteClientFieldDefFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      return deleteFieldDef(data.id);
    }),
  );

const setActiveSchema = z.object({ id: z.string().uuid("ID inválido"), active: z.boolean() });

export const setClientFieldActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setActiveSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      return setFieldActive(data.id, data.active);
    }),
  );

export const reorderClientFieldDefsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reorderSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      return reorderFieldDefs(data.ids);
    }),
  );

// ----------------------------------------------------------------------------
// B1 (2026-08-05) — vínculo campo-do-cliente → tema(s).
// ----------------------------------------------------------------------------
// Leitura: qualquer autenticado (a UI de gestão do campo carrega o estado).
export const listClientFieldTemaLinksFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ clientFieldDefId: z.string().uuid("ID inválido") }).parse(data),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAuth();
      return listClientFieldTemaLinks(data.clientFieldDefId);
    }),
  );

// Mutation: reconcilia os temas vinculados (cria/oculta defs-espelho). Admin-only.
export const setClientFieldTemaLinksFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setClientFieldTemaLinksSchema.parse(data))
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireModule("sistema", "edit");
      return reconcileClientFieldTemaLinks(data.clientFieldDefId, data.temaIds, me.id);
    }),
  );
