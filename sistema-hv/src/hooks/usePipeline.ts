import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  bifurcarCaseFn,
  createStageFn,
  listCasesByServiceTypeFn,
  listServiceTypesFn,
  listStagesFn,
  moveCaseToStageFinFn,
  moveCaseToStageOpFn,
  reorderStagesFn,
  setAcertoParcialFn,
  softDeleteStageFn,
  updateStageFn,
} from "@/rpc/pipeline";

export function useServiceTypes() {
  const fn = useServerFn(listServiceTypesFn);
  return useQuery({ queryKey: ["service-types"], queryFn: () => fn() });
}

export function useStages(serviceTypeId: string, kind: "op" | "fin") {
  const fn = useServerFn(listStagesFn);
  return useQuery({
    queryKey: ["pipeline-stages", serviceTypeId, kind],
    queryFn: () => fn({ data: { serviceTypeId, kind } }),
    enabled: !!serviceTypeId,
  });
}

export function useCasesByServiceType(serviceTypeId: string) {
  const fn = useServerFn(listCasesByServiceTypeFn);
  return useQuery({
    queryKey: ["cases-by-service", serviceTypeId],
    queryFn: () => fn({ data: { serviceTypeId } }),
    enabled: !!serviceTypeId,
  });
}

export function useMoveCaseStageOp(serviceTypeId: string) {
  const fn = useServerFn(moveCaseToStageOpFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string; stageId: string }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases-by-service", serviceTypeId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useMoveCaseStageFin(serviceTypeId: string) {
  const fn = useServerFn(moveCaseToStageFinFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string; stageId: string }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases-by-service", serviceTypeId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useBifurcarFinanceiro() {
  const fn = useServerFn(bifurcarCaseFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => fn({ data: { caseId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useSetAcertoParcial() {
  const fn = useServerFn(setAcertoParcialFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      caseId: string;
      acerto_parcial: boolean;
      tem_pendencia_judicial: boolean;
      obs?: string | null;
    }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useCreateStage(serviceTypeId: string, kind: "op" | "fin") {
  const fn = useServerFn(createStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      service_type_id: string;
      kind: "op" | "fin";
      slug: string;
      label: string;
      stage_role?: string;
      ordem?: number;
    }) => fn({ data: input as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}

export function useUpdateStage(serviceTypeId: string, kind: "op" | "fin") {
  const fn = useServerFn(updateStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) => fn({ data: vars as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}

export function useReorderStages(serviceTypeId: string, kind: "op" | "fin") {
  const fn = useServerFn(reorderStagesFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => fn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}

export function useDeleteStage(serviceTypeId: string, kind: "op" | "fin") {
  const fn = useServerFn(softDeleteStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}
