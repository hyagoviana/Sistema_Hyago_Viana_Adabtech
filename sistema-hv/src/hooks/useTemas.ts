import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createFrenteFn,
  createTemaFn,
  deleteFrenteFn,
  deleteTemaFn,
  listFrentesFn,
  listTemasFn,
  updateFrenteFn,
  updateTemaFn,
} from "@/rpc/temas";

// ------------------------------------------------------------------- Temas
export function useTemas() {
  const fn = useServerFn(listTemasFn);
  return useQuery({
    queryKey: ["temas"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000, // temas mudam raramente
  });
}

export function useCreateTema() {
  const fn = useServerFn(createTemaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug?: string; ordem?: number }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["temas"] }),
  });
}

export function useUpdateTema() {
  const fn = useServerFn(updateTemaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: { name?: string; ordem?: number; active?: boolean };
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["temas"] }),
  });
}

export function useDeleteTema() {
  const fn = useServerFn(deleteTemaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["temas"] });
      qc.invalidateQueries({ queryKey: ["tema-frentes"] });
    },
  });
}

// ------------------------------------------------------------------- Frentes
export function useFrentes(temaId: string | null | undefined) {
  const fn = useServerFn(listFrentesFn);
  return useQuery({
    queryKey: ["tema-frentes", temaId],
    queryFn: () => fn({ data: { temaId: temaId as string } }),
    enabled: !!temaId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateFrente(temaId: string) {
  const fn = useServerFn(createFrenteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; slug?: string; ordem?: number }) =>
      fn({ data: { temaId, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tema-frentes", temaId] }),
  });
}

export function useUpdateFrente(temaId: string) {
  const fn = useServerFn(updateFrenteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: { label?: string; ordem?: number; active?: boolean };
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tema-frentes", temaId] }),
  });
}

export function useDeleteFrente(temaId: string) {
  const fn = useServerFn(deleteFrenteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tema-frentes", temaId] }),
  });
}
