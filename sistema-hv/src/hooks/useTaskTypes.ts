// Hooks do catálogo ÚNICO de tipos de tarefa (doc 21.08 Controladoria).
// Consumido pela tela de Configurações, pelo builder de Workflows, pelo dossiê
// do caso e (adiante) pelas telas 1 e 2 do motor de distribuição.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createTaskTypeFn,
  listTaskTypesCatalogFn,
  removeThemeExclusiveFn,
  setTaskTypeArchivedFn,
  setThemeExclusiveFn,
  updateTaskTypeFn,
  criarTipoNoProjurisFn,
} from "@/rpc/task-types";
import type { TaskType } from "@/lib/task-types-service";

export type { TaskType };

type Filtro = {
  estado?: "ativos" | "arquivados" | "todos";
  classe?: string | null;
  soMotor?: boolean;
};

export function useTaskTypesCatalog(filtro: Filtro = {}) {
  const fn = useServerFn(listTaskTypesCatalogFn);
  return useQuery({
    queryKey: [
      "task-types-catalog",
      filtro.estado ?? "ativos",
      filtro.classe ?? null,
      !!filtro.soMotor,
    ],
    queryFn: () =>
      fn({
        data: {
          estado: filtro.estado,
          classe: (filtro.classe as never) ?? null,
          soMotor: filtro.soMotor,
        },
      }),
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["task-types-catalog"] });
    // A lista antiga do motor lê a mesma tabela — mantém as duas em sincronia.
    qc.invalidateQueries({ queryKey: ["task-type-mappings"] });
    qc.invalidateQueries({ queryKey: ["workflow-task-types"] });
  };
}

export function useCreateTaskType() {
  const fn = useServerFn(createTaskTypeFn);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => fn({ data: input as never }),
    onSuccess: invalidate,
  });
}

export function useUpdateTaskType() {
  const fn = useServerFn(updateTaskTypeFn);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      fn({ data: vars as never }),
    onSuccess: invalidate,
  });
}

export function useSetTaskTypeArchived() {
  const fn = useServerFn(setTaskTypeArchivedFn);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: string; archived: boolean }) => fn({ data: vars }),
    onSuccess: invalidate,
  });
}

export function useSetThemeExclusive() {
  const fn = useServerFn(setThemeExclusiveFn);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { taskTypeId: string; temaId: string; executorId: string }) =>
      fn({ data: vars }),
    onSuccess: invalidate,
  });
}

export function useRemoveThemeExclusive() {
  const fn = useServerFn(removeThemeExclusiveFn);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: string }) => fn({ data: vars }),
    onSuccess: invalidate,
  });
}

/** Cria no ProJuris um tipo que só existe no SHV. */
export function useCriarTipoNoProjuris() {
  const fn = useServerFn(criarTipoNoProjurisFn);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: string }) => fn({ data: vars }),
    onSuccess: invalidate,
  });
}
