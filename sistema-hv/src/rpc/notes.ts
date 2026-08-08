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
import { AuthError, requireAnyModule, requireAuth, requireModule } from "@/lib/supabase/auth-guard";

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
      // Ficha comum: só o balde 'geral' (regressão zero — notas antigas = geral).
      return listCaseNotes(data.caseId, "geral");
    }),
  );

// ----------------------------------------------------------------------------
// F1 — COMENTÁRIOS DO FINANCEIRO (scope='financeiro'). Gate por MÓDULO:
// leitura → `financeiro:view`; escrita/exclusão → `financeiro:edit`. Quem não
// tem `financeiro:view` recebe 403 e nunca lê os comentários do financeiro.
// ----------------------------------------------------------------------------
export const listCaseFinNotesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("financeiro", "view");
      return listCaseNotes(data.caseId, "financeiro");
    }),
  );

export const createCaseFinNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("financeiro", "edit");
      return createCaseNote(data.caseId, data.body, userId, "financeiro");
    }),
  );

export const updateCaseFinNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ noteId: z.string().uuid(), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("financeiro", "edit");
      return updateNote("case", data.noteId, data.body, userId);
    }),
  );

export const softDeleteCaseFinNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ noteId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("financeiro", "edit");
      return softDeleteNote("case", data.noteId, userId);
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
// M1 (2026-08-07) — regra Trello imposta no SERVIDOR: editar SÓ o autor; excluir
// o autor OU um admin. `enforceOwner: true` liga a validação (os RPCs financeiros
// seguem sem enforceOwner — gate por módulo). `role` vem de requireAnyModule.
export const updateNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ target: targetSchema, noteId: z.string().uuid(), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAnyModule(["comercial", "operacional"], "edit");
      return updateNote(data.target, data.noteId, data.body, userId, { enforceOwner: true });
    }),
  );

export const softDeleteNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ target: targetSchema, noteId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId, role } = await requireAnyModule(["comercial", "operacional"], "edit");
      return softDeleteNote(data.target, data.noteId, userId, {
        enforceOwner: true,
        isAdmin: role === "admin",
      });
    }),
  );
