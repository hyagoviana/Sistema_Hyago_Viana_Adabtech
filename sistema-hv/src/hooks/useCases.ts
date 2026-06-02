import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { MacroFin, MacroOp } from "@/lib/cases/constants";
import { queryKeys } from "@/lib/queryKeys";
import type { CaseCreateInput, CaseUpdateInput } from "@/lib/validators/case";
import {
  createCaseFn,
  getCaseFn,
  listCaseEventsFn,
  listCasesFn,
  moveCaseStatusFinFn,
  moveCaseStatusFn,
  softDeleteCaseFn,
  updateCaseFn,
} from "@/rpc/cases";

type Filters = {
  search?: string;
  macrostatus_op?: MacroOp;
  macrostatus_fin?: MacroFin;
  client_id?: string;
};

export function useCasesList(filters?: Filters) {
  const fn = useServerFn(listCasesFn);
  return useQuery({
    queryKey: queryKeys.cases.list(filters),
    queryFn: () => fn({ data: filters ?? {} }),
  });
}

export function useCase(id: string) {
  const fn = useServerFn(getCaseFn);
  return useQuery({
    queryKey: queryKeys.cases.detail(id),
    queryFn: () => fn({ data: { id } }),
    enabled: !!id,
  });
}

export function useCaseEvents(caseId: string) {
  const fn = useServerFn(listCaseEventsFn);
  return useQuery({
    queryKey: queryKeys.cases.events(caseId),
    queryFn: () => fn({ data: { id: caseId } }),
    enabled: !!caseId,
  });
}

export function useCreateCase() {
  const fn = useServerFn(createCaseFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseCreateInput) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useUpdateCase() {
  const fn = useServerFn(updateCaseFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: CaseUpdateInput }) => fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(vars.id) });
    },
  });
}

export function useMoveCaseStatus() {
  const fn = useServerFn(moveCaseStatusFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; to: MacroOp }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useMoveCaseStatusFin() {
  const fn = useServerFn(moveCaseStatusFinFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; to: MacroFin }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useDeleteCase() {
  const fn = useServerFn(softDeleteCaseFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}
