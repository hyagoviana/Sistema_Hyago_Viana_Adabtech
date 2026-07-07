import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  bifurcarCaseFn,
  createServiceTypeFn,
  createStageFn,
  entrarFinanceiroFn,
  listAllBifurcatedCasesFn,
  listCasesByServiceTypeFn,
  listComercialBoardFn,
  listLeadsByServiceTypeFn,
  listLeadsPipelineFn,
  listServiceTypesFn,
  listStagesFn,
  moveCaseToStageFinFn,
  moveCaseToStageOpFn,
  moveLeadStageComercialFn,
  reorderStagesFn,
  setAcertoParcialFn,
  softDeleteStageFn,
  updateStageFn,
  voltarOperacionalFn,
} from "@/rpc/pipeline";

// Espelha StageKind do pipeline-service (op | fin | comercial). Aditivo: chamadas
// existentes com "op"|"fin" continuam válidas.
export type StageKind = "op" | "fin" | "comercial";

export function useServiceTypes() {
  const fn = useServerFn(listServiceTypesFn);
  return useQuery({
    queryKey: ["service-types"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000, // 5 min — tipos de serviço mudam raramente
  });
}

export function useCreateServiceType() {
  const fn = useServerFn(createServiceTypeFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug: string; ordem?: number }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-types"] }),
  });
}

export function useStages(serviceTypeId: string, kind: StageKind) {
  const fn = useServerFn(listStagesFn);
  return useQuery({
    queryKey: ["pipeline-stages", serviceTypeId, kind],
    queryFn: () => fn({ data: { serviceTypeId, kind } }),
    enabled: !!serviceTypeId,
    staleTime: 5 * 60 * 1000, // 5 min — stages mudam raramente
  });
}

export function useAllBifurcatedCases() {
  const fn = useServerFn(listAllBifurcatedCasesFn);
  return useQuery({
    queryKey: ["cases-all-bifurcated"],
    queryFn: () => fn(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCasesByServiceType(serviceTypeId: string) {
  const fn = useServerFn(listCasesByServiceTypeFn);
  return useQuery({
    queryKey: ["cases-by-service", serviceTypeId],
    queryFn: () => fn({ data: { serviceTypeId } }),
    enabled: !!serviceTypeId,
    staleTime: 2 * 60 * 1000,
  });
}

// --------------------------------------------------------------- Leads (comercial)
export function useLeadsByServiceType(serviceTypeId: string) {
  const fn = useServerFn(listLeadsByServiceTypeFn);
  return useQuery({
    queryKey: ["leads-by-service", serviceTypeId],
    queryFn: () => fn({ data: { serviceTypeId } }),
    enabled: !!serviceTypeId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useLeadsPipeline() {
  const fn = useServerFn(listLeadsPipelineFn);
  return useQuery({
    queryKey: ["leads-pipeline"],
    queryFn: () => fn(),
    staleTime: 2 * 60 * 1000,
  });
}

// #15 — board comercial único (casos + cadastros-lead sintéticos).
export function useComercialBoard() {
  const fn = useServerFn(listComercialBoardFn);
  return useQuery({
    queryKey: ["comercial-board"],
    queryFn: () => fn(),
    staleTime: 60 * 1000,
  });
}

// ITEM 1 + 2 (2026-07-07) — move um CADASTRO (lead) entre etapas comerciais SEM
// criar caso. Optimistic update: o card salta de coluna INSTANTANEAMENTE (patch
// no cache ["comercial-board"]); o refetch em onSettled só confirma. `toSlug` é a
// etapa de destino (para o patch otimista).
export function useMoveLeadStageComercial() {
  const fn = useServerFn(moveLeadStageComercialFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { clientId: string; stageId: string; toSlug: string }) =>
      fn({ data: { clientId: vars.clientId, stageId: vars.stageId } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["comercial-board"] });
      const prev = qc.getQueryData(["comercial-board"]);
      qc.setQueryData(["comercial-board"], (old: unknown) =>
        Array.isArray(old)
          ? old.map((r) =>
              (r as { id: string }).id === vars.clientId
                ? { ...(r as object), macrostatus_comercial: vars.toSlug }
                : r,
            )
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["comercial-board"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comercial-board"] });
    },
  });
}

// ITEM 2 (2026-07-07) — optimistic update no move OPERACIONAL: patch imediato de
// macrostatus_op no cache ["cases-by-service", id] → card salta na hora.
export function useMoveCaseStageOp(serviceTypeId: string) {
  const fn = useServerFn(moveCaseToStageOpFn);
  const qc = useQueryClient();
  const key = ["cases-by-service", serviceTypeId];
  return useMutation({
    mutationFn: (vars: { caseId: string; stageId: string; toSlug: string }) =>
      fn({ data: { caseId: vars.caseId, stageId: vars.stageId } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        Array.isArray(old)
          ? old.map((c) =>
              (c as { id: string }).id === vars.caseId
                ? { ...(c as object), macrostatus_op: vars.toSlug }
                : c,
            )
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

// ITEM 2 (2026-07-07) — optimistic update no move FINANCEIRO: patch imediato de
// macrostatus_fin no cache ["cases-by-service", id].
export function useMoveCaseStageFin(serviceTypeId: string) {
  const fn = useServerFn(moveCaseToStageFinFn);
  const qc = useQueryClient();
  const key = ["cases-by-service", serviceTypeId];
  return useMutation({
    mutationFn: (vars: { caseId: string; stageId: string; toSlug?: string }) =>
      fn({ data: { caseId: vars.caseId, stageId: vars.stageId } }),
    onMutate: async (vars) => {
      if (!vars.toSlug) return { prev: undefined };
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        Array.isArray(old)
          ? old.map((c) =>
              (c as { id: string }).id === vars.caseId
                ? { ...(c as object), macrostatus_fin: vars.toSlug }
                : c,
            )
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["cases-all-bifurcated"] });
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

export function useEntrarFinanceiro() {
  const fn = useServerFn(entrarFinanceiroFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string; removerOperacional: boolean }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["cases-by-service"] });
    },
  });
}

export function useVoltarOperacional() {
  const fn = useServerFn(voltarOperacionalFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => fn({ data: { caseId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["cases-by-service"] });
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

export function useCreateStage(serviceTypeId: string, kind: StageKind) {
  const fn = useServerFn(createStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      service_type_id: string;
      kind: StageKind;
      slug: string;
      label: string;
      stage_role?: string;
      ordem?: number;
    }) => fn({ data: input as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}

export function useUpdateStage(serviceTypeId: string, kind: StageKind) {
  const fn = useServerFn(updateStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      fn({ data: vars as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}

export function useReorderStages(serviceTypeId: string, kind: StageKind) {
  const fn = useServerFn(reorderStagesFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => fn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}

export function useDeleteStage(serviceTypeId: string, kind: StageKind) {
  const fn = useServerFn(softDeleteStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", serviceTypeId, kind] }),
  });
}
