import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createTemaFieldDef,
  deleteTemaFieldDef,
  listTemaFieldDefs,
  listTemaFieldDefsAdmin,
  TEMA_FIELD_TYPES,
  updateTemaFieldDef,
} from "@/lib/tema-field-defs-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";

// R2-07 — DEFS de campo personalizado por TEMA/FRENTE.
// Leitura (não sensível): requireAuth. Escrita (defs): gate por MÓDULO server-side
// (B3 / I3, reunião 2026-08-05) — `requireModule('sistema','edit')`. `sistema:edit`
// (config.manage) hoje é do admin, então é EQUIVALENTE ao antigo `requireRole
// (["admin"])`, mas passa a honrar overrides por usuário (system_user_module_perms):
// um colaborador pode receber `sistema:edit` sem virar admin.
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

async function handleAdmin<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireModule("sistema", "edit");
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

const fieldTypeSchema = z.enum(TEMA_FIELD_TYPES);
const optionsSchema = z.array(z.string()).nullish();
const scopeSchema = z.enum(["caso", "cliente"]);
const maxOccSchema = z.number().int().min(1).max(20);

// Leitura para a FICHA do caso: defs do tema (frente NULL) + da frente do caso.
export const listTemaFieldDefsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temaId: z.string().uuid(),
        frenteSlug: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(() => listTemaFieldDefs(data.temaId, data.frenteSlug ?? null)),
  );

// Leitura para a UI ADMIN: todas as defs do tema (ou de uma frente específica).
export const listTemaFieldDefsAdminFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temaId: z.string().uuid(),
        // undefined = todas; null = só padrão do tema; string = só a frente.
        frenteSlug: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handleAdmin(() => listTemaFieldDefsAdmin(data.temaId, data.frenteSlug)),
  );

export const createTemaFieldDefFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temaId: z.string().uuid(),
        frenteSlug: z.string().nullish(),
        key: z.string().optional(),
        label: z.string().min(1),
        type: fieldTypeSchema,
        options: optionsSchema,
        ordem: z.number().optional(),
        required: z.boolean().optional(),
        scope: scopeSchema.optional(),
        hiddenInList: z.boolean().optional(),
        hiddenInFilters: z.boolean().optional(),
        maxOccurrences: maxOccSchema.optional(),
        // A5 (2026-08-05) — nº de linhas mostradas de largada (<= teto).
        initialOccurrences: maxOccSchema.optional(),
        // #8 (2026-08-17) — subtítulo por linha (multi-ocorrência).
        subtitleMode: z.enum(["auto", "custom"]).nullish(),
        subtitles: z.array(z.string()).optional(),
        // A5 5c — auto-avanço: slug da etapa op destino ao marcar "Sim" (boolean).
        moveToStageSlug: z.string().nullish(),
        // A4 (2026-08-05) — campo pai (dependência); null/omisso = sem dependência.
        parentFieldDefId: z.string().uuid().nullish(),
        // A7 (2026-08-05) — libera a checagem do balde compartilhado do cliente.
        allowSharedClientKey: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleAdmin(() => createTemaFieldDef(data)));

export const updateTemaFieldDefFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          label: z.string().min(1).optional(),
          type: fieldTypeSchema.optional(),
          options: optionsSchema,
          ordem: z.number().optional(),
          required: z.boolean().optional(),
          active: z.boolean().optional(),
          scope: scopeSchema.optional(),
          hiddenInList: z.boolean().optional(),
          hiddenInFilters: z.boolean().optional(),
          maxOccurrences: maxOccSchema.optional(),
          // A5 (2026-08-05) — nº de linhas mostradas de largada (<= teto).
          initialOccurrences: maxOccSchema.optional(),
          // #8 (2026-08-17) — subtítulo por linha (multi-ocorrência).
          subtitleMode: z.enum(["auto", "custom"]).nullish(),
          subtitles: z.array(z.string()).optional(),
          // A5 5c — auto-avanço: slug destino (null = não move).
          moveToStageSlug: z.string().nullish(),
          // A4 (2026-08-05) — reatribui/remove a dependência pai (null = remove).
          parentFieldDefId: z.string().uuid().nullish(),
          // A7 (2026-08-05) — libera a checagem do balde compartilhado do cliente.
          allowSharedClientKey: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleAdmin(() => updateTemaFieldDef(data.id, data.patch)));

export const deleteTemaFieldDefFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleAdmin(() => deleteTemaFieldDef(data.id)));
