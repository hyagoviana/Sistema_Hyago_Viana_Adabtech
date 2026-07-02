import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import {
  createCaseNoteFn,
  createClientNoteFn,
  listCaseNotesFn,
  listClientNotesFn,
  softDeleteNoteFn,
  updateNoteFn,
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
