import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { MacroFin, MacroOp } from "@/lib/cases/constants";
import { queryKeys } from "@/lib/queryKeys";
import type { CaseCreateInput, CaseUpdateInput } from "@/lib/validators/case";
import {
  createCaseFn,
  createComercialProcuracaoFn,
  getCaseFn,
  liberarCasoFn,
  listCaseEventsFn,
  listCasesFn,
  listComercialCasesFn,
  moveCaseStatusFinFn,
  moveCaseStatusFn,
  previewProcuracaoFn,
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
    staleTime: 2 * 60 * 1000, // 2 min
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

// Procuração comercial — preview dos campos <...> + valores do cadastro do
// cliente, para revisão antes de criar o caso. enabled só quando há os 2 ids.
export function usePreviewProcuracao(input: {
  clientId: string;
  templateId: string;
  municipio?: string | null;
  responsavel?: string | null;
}) {
  const fn = useServerFn(previewProcuracaoFn);
  return useQuery({
    queryKey: [
      "procuracao-preview",
      input.clientId,
      input.templateId,
      input.municipio ?? "",
      input.responsavel ?? "",
    ],
    queryFn: () =>
      fn({
        data: {
          client_id: input.clientId,
          template_id: input.templateId,
          municipio: input.municipio ?? undefined,
          responsavel: input.responsavel ?? undefined,
        },
      }),
    enabled: !!input.clientId && !!input.templateId,
    staleTime: 30 * 1000,
  });
}

// Procuração comercial — cria o caso, gera a procuração com os valores
// revisados, finaliza e envia ao ZapSign (dispara o e-mail) em um único passo.
export function useCreateComercialProcuracao() {
  const fn = useServerFn(createComercialProcuracaoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      case: CaseCreateInput;
      template_id: string;
      values: Record<string, string>;
      signer: { name: string; email?: string; sendAutomaticEmail?: boolean };
    }) => fn({ data: input as never }),
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

// Patcha otimisticamente o macrostatus de um caso em todas as listas em cache,
// pra o card "pular" de coluna na hora do drop. Retorna snapshot pra rollback.
function patchCaseInLists(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Record<string, unknown>,
) {
  const snapshot = qc.getQueriesData({ queryKey: queryKeys.cases.lists() });
  qc.setQueriesData<unknown>({ queryKey: queryKeys.cases.lists() }, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    return old.map((c) =>
      c && typeof c === "object" && (c as { id?: string }).id === id ? { ...c, ...patch } : c,
    );
  });
  return snapshot;
}

export function useMoveCaseStatus() {
  const fn = useServerFn(moveCaseStatusFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; to: MacroOp }) => fn({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.cases.lists() });
      const snapshot = patchCaseInLists(qc, vars.id, {
        macrostatus_op: vars.to,
        status_changed_at: new Date().toISOString(),
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useMoveCaseStatusFin() {
  const fn = useServerFn(moveCaseStatusFinFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; to: MacroFin }) => fn({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.cases.lists() });
      const snapshot = patchCaseInLists(qc, vars.id, {
        macrostatus_fin: vars.to,
        status_fin_changed_at: new Date().toISOString(),
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
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

// ----------------------------------------------------------------------------
// Comercial (Melhoria 3) — casos aguardando assinatura da procuração
// ----------------------------------------------------------------------------
export function useComercialCases() {
  const fn = useServerFn(listComercialCasesFn);
  return useQuery({
    queryKey: queryKeys.cases.comercial(),
    queryFn: () => fn(),
    staleTime: 60 * 1000,
  });
}

export function useLiberarCaso() {
  const fn = useServerFn(liberarCasoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.all });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
    },
  });
}
