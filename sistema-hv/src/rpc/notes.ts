// Server functions das notas (S4-03). Auth-only: qualquer usuário autenticado
// lê/escreve (requireAuth, SEM requireRole). Escrita grava ator (created_by) e
// soft-delete grava deleted_by/deleted_at.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  NoteServiceError,
  createCaseNote,
  createClientNote,
  listCaseNotes,
  listClientNotes,
  softDeleteNote,
  updateNote,
} from "@/lib/notes-service";
import { AuthError, requireAnyModule, requireAuth } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof NoteServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

const targetSchema = z.enum(["case", "client"]);

// ----------------------------------------------------------------------------
// LISTAGEM (autenticada).
// ----------------------------------------------------------------------------
export const listCaseNotesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAuth();
      return listCaseNotes(data.caseId);
    }),
  );

export const listClientNotesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAuth();
      return listClientNotes(data.clientId);
    }),
  );

// ----------------------------------------------------------------------------
// CRIAÇÃO (autenticada — created_by = usuário).
// ----------------------------------------------------------------------------
export const createCaseNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAnyModule(["comercial", "operacional"], "edit");
      return createCaseNote(data.caseId, data.body, userId);
    }),
  );

export const createClientNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAnyModule(["comercial", "operacional"], "edit");
      return createClientNote(data.clientId, data.body, userId);
    }),
  );

// ----------------------------------------------------------------------------
// EDIÇÃO / SOFT-DELETE (autenticada).
// ----------------------------------------------------------------------------
export const updateNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ target: targetSchema, noteId: z.string().uuid(), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAnyModule(["comercial", "operacional"], "edit");
      return updateNote(data.target, data.noteId, data.body, userId);
    }),
  );

export const softDeleteNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ target: targetSchema, noteId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAnyModule(["comercial", "operacional"], "edit");
      return softDeleteNote(data.target, data.noteId, userId);
    }),
  );
