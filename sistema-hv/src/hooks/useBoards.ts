import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  addCaseToBoardFn,
  createBoardFn,
  createBoardStageFn,
  deleteBoardFn,
  deleteBoardStageFn,
  listBoardsFn,
  listBoardStagesFn,
  listCaseBoardsFn,
  listCasesByBoardFn,
  moveCaseBetweenBoardsFn,
  moveCaseInBoardFn,
  removeCaseFromBoardFn,
  reorderBoardStagesFn,
  reorderBoardsFn,
  updateBoardFn,
  updateBoardStageFn,
} from "@/rpc/boards";

// A3 — hooks dos boards (múltiplos Kanbans por tema). Campos/filtros continuam
// vindo do TEMA (useTemaFieldDefs) — os boards NÃO têm campos/filtros próprios.

export function useBoards(serviceTypeId: string) {
  const fn = useServerFn(listBoardsFn);
  return useQuery({
    queryKey: ["pipeline-boards", serviceTypeId],
    queryFn: () => fn({ data: { serviceTypeId } }),
    enabled: !!serviceTypeId,
    // Problema #1/#2 — a barra de boards precisa refletir criações/exclusões na
    // hora. staleTime curto (10s) + invalidação nos mutations garante que o board
    // recém-criado apareça no seletor sem refresh manual.
    staleTime: 10 * 1000,
  });
}

export function useCreateBoard(serviceTypeId: string) {
  const fn = useServerFn(createBoardFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { service_type_id: string; label: string; ordem?: number }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-boards", serviceTypeId] }),
  });
}

export function useUpdateBoard(serviceTypeId: string) {
  const fn = useServerFn(updateBoardFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: { label?: string; ordem?: number; active?: boolean };
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-boards", serviceTypeId] }),
  });
}

export function useReorderBoards(serviceTypeId: string) {
  const fn = useServerFn(reorderBoardsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => fn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-boards", serviceTypeId] }),
  });
}

export function useDeleteBoard(serviceTypeId: string) {
  const fn = useServerFn(deleteBoardFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-boards", serviceTypeId] }),
  });
}

export function useBoardStages(boardId: string | null) {
  const fn = useServerFn(listBoardStagesFn);
  return useQuery({
    queryKey: ["board-stages", boardId],
    queryFn: () => fn({ data: { boardId: boardId! } }),
    enabled: !!boardId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBoardStage(boardId: string | null) {
  const fn = useServerFn(createBoardStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      board_id: string;
      slug?: string;
      label: string;
      stage_role?: string;
      ordem?: number;
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-stages", boardId] });
      // Problema #1/#2 — o board novo/etapas afetam a barra de boards e as colunas
      // do kanban custom; invalida a lista de boards do tema também (barata) para
      // manter o seletor coerente após editar etapas.
      qc.invalidateQueries({ queryKey: ["pipeline-boards"] });
    },
  });
}

export function useUpdateBoardStage(boardId: string | null) {
  const fn = useServerFn(updateBoardStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: { label?: string; ordem?: number; stage_role?: string };
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-stages", boardId] }),
  });
}

export function useReorderBoardStages(boardId: string | null) {
  const fn = useServerFn(reorderBoardStagesFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => fn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-stages", boardId] }),
  });
}

export function useDeleteBoardStage(boardId: string | null) {
  const fn = useServerFn(deleteBoardStageFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-stages", boardId] }),
  });
}

// AJUSTE #2 (item 5) — boards custom em que o caso já está (p/ excluir do destino).
export function useCaseBoards(caseId: string | null) {
  const fn = useServerFn(listCaseBoardsFn);
  return useQuery({
    queryKey: ["case-boards", caseId],
    queryFn: () => fn({ data: { caseId: caseId! } }),
    enabled: !!caseId,
    staleTime: 60 * 1000,
  });
}

export function useCasesByBoard(boardId: string | null) {
  const fn = useServerFn(listCasesByBoardFn);
  return useQuery({
    queryKey: ["cases-by-board", boardId],
    queryFn: () => fn({ data: { boardId: boardId! } }),
    enabled: !!boardId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddCaseToBoard() {
  const fn = useServerFn(addCaseToBoardFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string; boardId: string }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["cases-by-board", vars.boardId] });
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["case-events"] });
    },
  });
}

// AJUSTE #2 (item 5) — MOVER o caso entre kanbans (add no destino + sai da origem
// custom). Invalida os dois boards + eventos do caso.
export function useMoveCaseBetweenBoards() {
  const fn = useServerFn(moveCaseBetweenBoardsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string; toBoardId: string; fromBoardId?: string | null }) =>
      fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["cases-by-board", vars.toBoardId] });
      if (vars.fromBoardId)
        qc.invalidateQueries({ queryKey: ["cases-by-board", vars.fromBoardId] });
      qc.invalidateQueries({ queryKey: ["case-boards", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["case-events"] });
    },
  });
}

// AJUSTE #2 (item 5) — remove o caso de um board custom.
export function useRemoveCaseFromBoard() {
  const fn = useServerFn(removeCaseFromBoardFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string; boardId: string }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["cases-by-board", vars.boardId] });
      qc.invalidateQueries({ queryKey: ["case-boards", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case-events"] });
    },
  });
}

// Move um caso entre etapas de um board custom. Optimistic update: o card salta
// de coluna na hora (patch de `board_stage_slug` no cache ["cases-by-board", id]).
export function useMoveCaseInBoard(boardId: string | null) {
  const fn = useServerFn(moveCaseInBoardFn);
  const qc = useQueryClient();
  const key = ["cases-by-board", boardId];
  return useMutation({
    mutationFn: (vars: { caseId: string; stageId: string; toSlug: string }) =>
      fn({ data: { caseId: vars.caseId, boardId: boardId!, stageId: vars.stageId } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        Array.isArray(old)
          ? old.map((c) =>
              (c as { id: string }).id === vars.caseId
                ? { ...(c as object), board_stage_slug: vars.toSlug }
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
