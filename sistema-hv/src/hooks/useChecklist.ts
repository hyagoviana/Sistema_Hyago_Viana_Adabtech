import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import {
  createAdhocChecklistItemFn,
  createChecklistDefFn,
  deleteAdhocChecklistItemFn,
  listCaseChecklistItemsFn,
  listChecklistDefsFn,
  marcarItemChecklistFn,
  reorderChecklistDefsFn,
  setChecklistItemAssigneeFn,
  softDeleteChecklistDefFn,
  updateAdhocChecklistItemFn,
  updateChecklistDefFn,
} from "@/rpc/checklist";

// ----------------------------------------------------------------------------
// DEFS (editor de funil por tipo — S2-02)
// ----------------------------------------------------------------------------
export function useChecklistDefs(serviceTypeId: string | undefined, stageSlug: string | undefined) {
  const fn = useServerFn(listChecklistDefsFn);
  return useQuery({
    queryKey: queryKeys.checklistDefs.byStage(serviceTypeId ?? "", stageSlug ?? ""),
    queryFn: () => fn({ data: { serviceTypeId: serviceTypeId!, stageSlug: stageSlug! } }),
    enabled: !!serviceTypeId && !!stageSlug,
    staleTime: 60 * 1000,
  });
}

export function useCreateChecklistDef() {
  const fn = useServerFn(createChecklistDefFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      service_type_id: string;
      stage_slug: string;
      label: string;
      required?: boolean;
      expected_doc_pattern?: string | null;
      assigned_to?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklistDefs.all }),
  });
}

export function useUpdateChecklistDef() {
  const fn = useServerFn(updateChecklistDefFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: {
        label?: string;
        ordem?: number;
        required?: boolean;
        active?: boolean;
        expected_doc_pattern?: string | null;
        assigned_to?: string | null;
      };
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklistDefs.all }),
  });
}

export function useReorderChecklistDefs() {
  const fn = useServerFn(reorderChecklistDefsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => fn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklistDefs.all }),
  });
}

export function useDeleteChecklistDef() {
  const fn = useServerFn(softDeleteChecklistDefFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklistDefs.all }),
  });
}

// ----------------------------------------------------------------------------
// ITENS (ficha do caso — S2-04/S2-05/S2-06)
// ----------------------------------------------------------------------------
export function useCaseChecklistItems(caseId: string) {
  const fn = useServerFn(listCaseChecklistItemsFn);
  return useQuery({
    queryKey: queryKeys.checklistItems.byCase(caseId),
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

// Invalidações compartilhadas: itens do caso + caso/timeline/kanban (o gate pode
// ter avançado a etapa). Reusado por marcar item e pelas mutações ad-hoc (S9-11).
function invalidateAfterChecklistMutation(qc: ReturnType<typeof useQueryClient>, caseId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.checklistItems.byCase(caseId) });
  qc.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
  qc.invalidateQueries({ queryKey: queryKeys.cases.events(caseId) });
  qc.invalidateQueries({ queryKey: queryKeys.cases.lists() });
  // Kanban (op/fin/comercial) lê por tipo de serviço → invalida p/ o card pular de coluna.
  qc.invalidateQueries({ queryKey: ["cases-by-service"] });
}

export function useMarcarItemChecklist(caseId: string) {
  const fn = useServerFn(marcarItemChecklistFn);
  const qc = useQueryClient();
  const key = queryKeys.checklistItems.byCase(caseId);
  return useMutation({
    mutationFn: (vars: { itemId: string; done: boolean }) => fn({ data: vars }),
    // Optimistic: o check vira INSTANTÂNEO no UI; o refetch em onSettled confirma
    // (e traz o eventual avanço de etapa disparado pelo gate).
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        Array.isArray(old)
          ? old.map((it) =>
              (it as { id: string }).id === vars.itemId
                ? { ...(it as object), done: vars.done }
                : it,
            )
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => invalidateAfterChecklistMutation(qc, caseId),
  });
}

// (item 3) — vincula/desvincula o responsável (usuário) de um item de checklist.
export function useSetChecklistItemAssignee(caseId: string) {
  const fn = useServerFn(setChecklistItemAssigneeFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { itemId: string; assignedTo: string | null }) => fn({ data: vars }),
    onSuccess: () => invalidateAfterChecklistMutation(qc, caseId),
  });
}

// ----------------------------------------------------------------------------
// ITENS AD-HOC POR CASO (S9-11) — criar/editar/excluir critérios extras do caso.
// ----------------------------------------------------------------------------
export function useCreateAdhocChecklistItem(caseId: string) {
  const fn = useServerFn(createAdhocChecklistItemFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { stageSlug: string; label: string; required?: boolean }) =>
      fn({ data: { caseId, ...vars } }),
    onSuccess: () => invalidateAfterChecklistMutation(qc, caseId),
  });
}

export function useUpdateAdhocChecklistItem(caseId: string) {
  const fn = useServerFn(updateAdhocChecklistItemFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { itemId: string; patch: { label?: string; required?: boolean } }) =>
      fn({ data: vars }),
    onSuccess: () => invalidateAfterChecklistMutation(qc, caseId),
  });
}

export function useDeleteAdhocChecklistItem(caseId: string) {
  const fn = useServerFn(deleteAdhocChecklistItemFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => fn({ data: { itemId } }),
    onSuccess: () => invalidateAfterChecklistMutation(qc, caseId),
  });
}
