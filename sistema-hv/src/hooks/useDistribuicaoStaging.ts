// Hooks das duas etapas humanas do motor (doc 21.08): andamentos pendentes e
// tarefas a distribuir.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  cancelStagingItemFn,
  decideMovementFn,
  distribuirStagingFn,
  listMovementsFn,
  listStagingFn,
  syncMovementsFn,
  updateStagingItemFn,
  enviarInicialParaDistribuicaoFn,
  listHistoricoAndamentosFn,
  listHistoricoTarefasFn,
} from "@/rpc/distribuicao-staging";
import type { Movement, StagingItem } from "@/lib/distribuicao/staging-core";

export type { Movement, StagingItem };

const KEY_MOV = ["distribuicao-movements"];
const KEY_STG = ["distribuicao-staging"];

export function useMovements(
  decisao: string = "PENDENTE",
  data: string | null = null,
  ocultarArquivadas = false,
) {
  const fn = useServerFn(listMovementsFn);
  return useQuery({
    queryKey: [...KEY_MOV, decisao, data, ocultarArquivadas],
    queryFn: () => fn({ data: { decisao: decisao as never, data, ocultarArquivadas } }),
  });
}

export function useSyncMovements() {
  const fn = useServerFn(syncMovementsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars?: { data?: string | null; windowDays?: number }) =>
      fn({ data: { data: vars?.data ?? null, windowDays: vars?.windowDays } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_MOV }),
  });
}

export function useDecideMovement() {
  const fn = useServerFn(decideMovementFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      movementId: string;
      decisao: "PENDENTE" | "ARQUIVADO" | "LIDO" | "DISTRIBUIR";
      taskTypeId?: string | null;
    }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_MOV });
      qc.invalidateQueries({ queryKey: KEY_STG });
    },
  });
}

export function useStaging(status: "ABERTA" | "DISTRIBUIDA" | "CANCELADA" = "ABERTA") {
  const fn = useServerFn(listStagingFn);
  return useQuery({
    queryKey: [...KEY_STG, status],
    queryFn: () => fn({ data: { status } }),
  });
}

export function useUpdateStagingItem() {
  const fn = useServerFn(updateStagingItemFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      fn({ data: vars as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_STG }),
  });
}

export function useCancelStagingItem() {
  const fn = useServerFn(cancelStagingItemFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_STG });
      qc.invalidateQueries({ queryKey: KEY_MOV });
    },
  });
}

export function useDistribuirStaging() {
  const fn = useServerFn(distribuirStagingFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ids: string[]; data?: string | null }) =>
      fn({ data: { ids: vars.ids, data: vars.data ?? null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_STG });
      // O resultado cai nas telas que já existem (Relatório, Lista, Indicadores).
      qc.invalidateQueries({ queryKey: ["distribution-results"] });
      qc.invalidateQueries({ queryKey: ["distribuicao"] });
    },
  });
}

/** Manda a inicial do caso para a fila de análise da controladoria (tela 1). */
export function useEnviarInicialParaDistribuicao() {
  const fn = useServerFn(enviarInicialParaDistribuicaoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_MOV }),
  });
}

export function useHistoricoAndamentos(
  de: string | null,
  ate: string | null,
  decisao: string | null,
) {
  const fn = useServerFn(listHistoricoAndamentosFn);
  return useQuery({
    queryKey: ["distribuicao-hist-andamentos", de, ate, decisao],
    queryFn: () => fn({ data: { de, ate, decisao } }),
  });
}

export function useHistoricoTarefas(de: string | null, ate: string | null) {
  const fn = useServerFn(listHistoricoTarefasFn);
  return useQuery({
    queryKey: ["distribuicao-hist-tarefas", de, ate],
    queryFn: () => fn({ data: { de, ate } }),
  });
}
