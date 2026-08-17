import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import {
  createCaseNoteFn,
  createCaseFinNoteFn,
  createCaseObsNoteFn,
  createClientNoteFn,
  listCaseNotesFn,
  listCaseFinNotesFn,
  listCaseObsNotesFn,
  listClientNotesFn,
  softDeleteNoteFn,
  softDeleteCaseFinNoteFn,
  softDeleteCaseObsNoteFn,
  updateNoteFn,
  updateCaseFinNoteFn,
  updateCaseObsNoteFn,
} from "@/rpc/notes";

export type NoteTarget = "case" | "client";

// ----------------------------------------------------------------------------
// LISTAGEM
// ----------------------------------------------------------------------------
export function useCaseNotes(caseId: string) {
  const fn = useServerFn(listCaseNotesFn);
  return useQuery({
    queryKey: queryKeys.notes.byCase(caseId),
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useClientNotes(clientId: string) {
  const fn = useServerFn(listClientNotesFn);
  return useQuery({
    queryKey: queryKeys.notes.byClient(clientId),
    queryFn: () => fn({ data: { clientId } }),
    enabled: !!clientId,
  });
}

// F1 — comentários do FINANCEIRO (scope='financeiro'). Gate por `financeiro`.
export function useCaseFinNotes(caseId: string, enabled = true) {
  const fn = useServerFn(listCaseFinNotesFn);
  return useQuery({
    queryKey: queryKeys.notes.byCaseFin(caseId),
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId && enabled,
  });
}

export function useCreateCaseFinNote(caseId: string) {
  const fn = useServerFn(createCaseFinNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => fn({ data: { caseId, body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byCaseFin(caseId) }),
  });
}

export function useUpdateCaseFinNote(caseId: string) {
  const fn = useServerFn(updateCaseFinNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { noteId: string; body: string }) =>
      fn({ data: { noteId: vars.noteId, body: vars.body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byCaseFin(caseId) }),
  });
}

export function useSoftDeleteCaseFinNote(caseId: string) {
  const fn = useServerFn(softDeleteCaseFinNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => fn({ data: { noteId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byCaseFin(caseId) }),
  });
}

// #6 (2026-08-17) — OBSERVAÇÕES do caso (scope='observacao'). Painel próprio na
// ficha, no modelo da linha do tempo (autor/data).
export function useCaseObsNotes(caseId: string) {
  const fn = useServerFn(listCaseObsNotesFn);
  return useQuery({
    queryKey: queryKeys.notes.byCaseObs(caseId),
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useCreateCaseObsNote(caseId: string) {
  const fn = useServerFn(createCaseObsNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => fn({ data: { caseId, body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byCaseObs(caseId) }),
  });
}

export function useUpdateCaseObsNote(caseId: string) {
  const fn = useServerFn(updateCaseObsNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { noteId: string; body: string }) =>
      fn({ data: { noteId: vars.noteId, body: vars.body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byCaseObs(caseId) }),
  });
}

export function useSoftDeleteCaseObsNote(caseId: string) {
  const fn = useServerFn(softDeleteCaseObsNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => fn({ data: { noteId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byCaseObs(caseId) }),
  });
}

// ----------------------------------------------------------------------------
// MUTATIONS
// ----------------------------------------------------------------------------
export function useCreateCaseNote(caseId: string) {
  const fn = useServerFn(createCaseNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => fn({ data: { caseId, body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byCase(caseId) }),
  });
}

export function useCreateClientNote(clientId: string) {
  const fn = useServerFn(createClientNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => fn({ data: { clientId, body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.byClient(clientId) }),
  });
}

export function useUpdateNote(target: NoteTarget, entityId: string) {
  const fn = useServerFn(updateNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { noteId: string; body: string }) =>
      fn({ data: { target, noteId: vars.noteId, body: vars.body } }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey:
          target === "case" ? queryKeys.notes.byCase(entityId) : queryKeys.notes.byClient(entityId),
      }),
  });
}

export function useSoftDeleteNote(target: NoteTarget, entityId: string) {
  const fn = useServerFn(softDeleteNoteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => fn({ data: { target, noteId } }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey:
          target === "case" ? queryKeys.notes.byCase(entityId) : queryKeys.notes.byClient(entityId),
      }),
  });
}
