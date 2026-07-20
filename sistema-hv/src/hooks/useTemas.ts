import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createFrenteFn,
  createTemaFn,
  deleteFrenteFn,
  deleteTemaFn,
  ensureTemaFolderFn,
  getTemaServiceTypeFn,
  linkTemaFolderFn,
  listFrentesFn,
  listTemasFn,
  listTemasRootFoldersFn,
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
    // A10 (2026-07-20) — o rename também renomeia o service_type interno; invalida
    // ambos os caches para os rótulos (nome do tema no topo do caso) atualizarem.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["temas"] });
      qc.invalidateQueries({ queryKey: ["service-types"] });
    },
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

// T2 — cria/garante a pasta-raiz do tema no Drive. Invalida ["temas"] para o
// link da pasta aparecer na hora.
export function useEnsureTemaFolder() {
  const fn = useServerFn(ensureTemaFolderFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (temaId: string) => fn({ data: { temaId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["temas"] }),
  });
}

export type TemaRootFolder = { id: string; name: string; url: string };

// Pastas dentro da raiz "tema" (1PtxXw) — para escolher a pasta de um tema.
export function useTemasRootFolders(enabled = true) {
  const fn = useServerFn(listTemasRootFoldersFn);
  return useQuery({
    queryKey: ["temas-root-folders"],
    queryFn: () => fn() as Promise<TemaRootFolder[]>,
    enabled,
    staleTime: 60 * 1000,
  });
}

// Vincula ao tema uma pasta existente do Drive (a que o owner já criou).
export function useLinkTemaFolder() {
  const fn = useServerFn(linkTemaFolderFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { temaId: string; driveFolderId: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["temas"] }),
  });
}

// R2-04 — id do service_type INTERNO do tema (motor onde as pastas por frente
// são vinculadas). Retorna { id } | null.
export function useTemaServiceType(temaId: string | null | undefined) {
  const fn = useServerFn(getTemaServiceTypeFn);
  return useQuery({
    queryKey: ["tema-service-type", temaId],
    queryFn: () => fn({ data: { temaId: temaId as string } }),
    enabled: !!temaId,
    staleTime: 5 * 60 * 1000,
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
