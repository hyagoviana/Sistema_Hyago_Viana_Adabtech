import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ChecklistServiceError,
  createChecklistDef,
  instanciarChecklist,
  listCaseChecklistItems,
  listChecklistDefs,
  marcarItemChecklist,
  reorderChecklistDefs,
  softDeleteChecklistDef,
  sugerirChecklistPorUpload,
  updateChecklistDef,
} from "@/lib/checklist-service";
import { AuthError, requireAuth, requireRole } from "@/lib/supabase/auth-guard";

const ADMIN_ONLY = ["admin"] as const;

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof ChecklistServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// DEFS (S2-02) — leitura autenticada; mutações admin-only.
// ----------------------------------------------------------------------------
export const listChecklistDefsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ serviceTypeId: z.string().uuid(), stageSlug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAuth();
      return listChecklistDefs(data.serviceTypeId, data.stageSlug);
    }),
  );

export const createChecklistDefFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        service_type_id: z.string().uuid(),
        stage_slug: z.string().min(1),
        label: z.string().min(1),
        ordem: z.number().optional(),
        required: z.boolean().optional(),
        expected_doc_pattern: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return createChecklistDef(data);
    }),
  );

export const updateChecklistDefFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          label: z.string().optional(),
          ordem: z.number().optional(),
          required: z.boolean().optional(),
          active: z.boolean().optional(),
          expected_doc_pattern: z.string().nullish(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return updateChecklistDef(data.id, data.patch);
    }),
  );

export const reorderChecklistDefsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return reorderChecklistDefs(data.ids);
    }),
  );

export const softDeleteChecklistDefFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireRole(ADMIN_ONLY);
      return softDeleteChecklistDef(data.id);
    }),
  );

// ----------------------------------------------------------------------------
// ITENS (S2-03/S2-04/S2-05) — leitura + marcar + instanciar (autenticado).
// ----------------------------------------------------------------------------
export const listCaseChecklistItemsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAuth();
      return listCaseChecklistItems(data.caseId);
    }),
  );

export const marcarItemChecklistFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ itemId: z.string().uuid(), done: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAuth();
      return marcarItemChecklist(data.itemId, data.done, userId);
    }),
  );

// Força a instanciação (caso legado que entrou numa etapa sem itens). Idempotente.
export const instanciarChecklistFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), stageSlug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAuth();
      return instanciarChecklist(data.caseId, data.stageSlug);
    }),
  );

// S2-06 — gancho de sugestão por upload (desligado por default via flag).
export const sugerirChecklistPorUploadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        fileName: z.string().min(1),
        driveFileId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAuth();
      return sugerirChecklistPorUpload(data.caseId, data.fileName, data.driveFileId);
    }),
  );
