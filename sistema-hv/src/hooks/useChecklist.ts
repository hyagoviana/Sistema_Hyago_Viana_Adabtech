import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import {
  createChecklistDefFn,
  listCaseChecklistItemsFn,
  listChecklistDefsFn,
  marcarItemChecklistFn,
  reorderChecklistDefsFn,
  softDeleteChecklistDefFn,
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

export function useMarcarItemChecklist(caseId: string) {
  const fn = useServerFn(marcarItemChecklistFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { itemId: string; done: boolean }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checklistItems.byCase(caseId) });
      // O gate pode ter avançado a etapa → invalida o caso e a timeline.
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(caseId) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.lists() });
    },
  });
}
