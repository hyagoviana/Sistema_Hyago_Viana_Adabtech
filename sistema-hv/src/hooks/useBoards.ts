import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  addCaseToBoardFn,
  caseHasExclusivePositionFn,
  caseIdsByBoardFn,
  createBoardFn,
  createBoardStageFn,
  deleteBoardFn,
  deleteBoardStageFn,
  exclusiveCaseIdsFn,
  listBoardsFn,
  listBoardStagesFn,
  listCaseBoardsFn,
  listCaseOperationalTrailFn,
  listCasesByBoardFn,
  moveCaseBetweenBoardsFn,
  moveCaseInBoardFn,
  removeCaseFromBoardFn,
  reorderBoardStagesFn,
  reorderBoardsFn,
  returnCaseToPrincipalFn,
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

// C3 (2026-08-05) — rastro operacional agregado (multi-kanban) do caso: principal
// + boards custom com labels já resolvidos. Uma chamada (sem N+1). Invalidado
// pelos mutations de board (add/move/remove/return) p/ refletir na hora.
export function useCaseOperationalTrail(caseId: string | null) {
  const fn = useServerFn(listCaseOperationalTrailFn);
  return useQuery({
    queryKey: ["case-op-trail", caseId],
    queryFn: () => fn({ data: { caseId: caseId! } }),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

// TAREFA B (2026-08-04) — só os IDs dos casos num board custom (p/ filtrar a Lista
// client-side ao escolher um kanban específico). Leve (não carrega os casos).
export function useCaseIdsByBoard(boardId: string | null) {
  const fn = useServerFn(caseIdsByBoardFn);
  return useQuery({
    queryKey: ["case-ids-by-board", boardId],
    queryFn: () => fn({ data: { boardId: boardId! } }),
    enabled: !!boardId,
    staleTime: 60 * 1000,
  });
}

// TAREFA B — IDs dos casos movidos exclusivamente p/ custom (p/ o filtro do
// PRINCIPAL na Lista). `enabled` controla a busca (só quando útil).
export function useExclusiveCaseIds(enabled = true) {
  const fn = useServerFn(exclusiveCaseIdsFn);
  return useQuery({
    queryKey: ["exclusive-case-ids"],
    queryFn: () => fn({ data: {} }),
    enabled,
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
    mutationFn: (vars: {
      caseId: string;
      boardId: string;
      exclusive?: boolean;
      stageId?: string | null;
    }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["cases-by-board", vars.boardId] });
      // A4 — mover exclusivo tira o caso do principal → invalida também o kanban
      // principal (cases-by-service) e os demais boards custom do caso.
      qc.invalidateQueries({ queryKey: ["cases-by-board"] });
      qc.invalidateQueries({ queryKey: ["cases-by-service"] });
      qc.invalidateQueries({ queryKey: ["case-boards", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case-exclusive", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case-op-trail", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["case-events"] });
    },
  });
}

// AJUSTE #2 (item 5) + A4 — MOVER/DUPLICAR o caso entre kanbans. Mover exclusivo
// tira o caso do principal e dos demais boards; duplicar é aditivo; destino
// principal = voltar ao principal. Invalida boards + principal + eventos.
export function useMoveCaseBetweenBoards() {
  const fn = useServerFn(moveCaseBetweenBoardsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      caseId: string;
      toBoardId: string;
      exclusive?: boolean;
      stageId?: string | null;
    }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["cases-by-board"] });
      qc.invalidateQueries({ queryKey: ["cases-by-service"] });
      qc.invalidateQueries({ queryKey: ["case-boards", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case-exclusive", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case-op-trail", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["case-events"] });
    },
  });
}

// A4 — "voltar ao principal": remove todas as posições custom. Reaparece no
// PrincipalKanban e some dos custom.
export function useReturnCaseToPrincipal() {
  const fn = useServerFn(returnCaseToPrincipalFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { caseId: string }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["cases-by-board"] });
      qc.invalidateQueries({ queryKey: ["cases-by-service"] });
      qc.invalidateQueries({ queryKey: ["case-boards", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case-exclusive", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case-op-trail", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["case"] });
      qc.invalidateQueries({ queryKey: ["case-events"] });
    },
  });
}

// A4 — o caso está movido exclusivamente para fora do principal?
export function useCaseHasExclusivePosition(caseId: string | null) {
  const fn = useServerFn(caseHasExclusivePositionFn);
  return useQuery({
    queryKey: ["case-exclusive", caseId],
    queryFn: () => fn({ data: { caseId: caseId! } }),
    enabled: !!caseId,
    staleTime: 30 * 1000,
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
      qc.invalidateQueries({ queryKey: ["case-op-trail", vars.caseId] });
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
    onSettled: (_res, _err, vars) => {
      qc.invalidateQueries({ queryKey: key });
      // C3 — a etapa do board custom mudou → o rastro operacional da ficha reflete.
      qc.invalidateQueries({ queryKey: ["case-op-trail", vars.caseId] });
    },
  });
}
