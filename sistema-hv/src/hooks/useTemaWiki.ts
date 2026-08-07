import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createTemaWikiBlockFn,
  deleteTemaWikiBlockFn,
  listTemaWikiBlocksFn,
  reorderTemaWikiBlocksFn,
  updateTemaWikiBlockFn,
} from "@/rpc/tema-wiki";

// C5 (2026-08-05) — "Links úteis" / wiki por TEMA. Um bloco = um quadro com título
// editável + itens (caixinhas texto/link) em JSONB. Reads p/ todos; writes admin.

export type WikiItem = {
  id: string;
  tipo: "texto" | "link";
  valor: string;
  rotulo?: string;
};

export type TemaWikiBlock = {
  id: string;
  organization_id: string;
  tema_id: string;
  titulo: string;
  itens: WikiItem[];
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function useTemaWiki(temaId: string | null | undefined) {
  const fn = useServerFn(listTemaWikiBlocksFn);
  return useQuery({
    queryKey: ["tema-wiki", temaId],
    queryFn: () => fn({ data: { temaId: temaId as string } }),
    enabled: !!temaId,
    staleTime: 60 * 1000,
  });
}

export function useCreateTemaWikiBlock(temaId: string) {
  const fn = useServerFn(createTemaWikiBlockFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { titulo: string; itens?: WikiItem[]; ordem?: number }) =>
      fn({ data: { temaId, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tema-wiki", temaId] }),
  });
}

export function useUpdateTemaWikiBlock(temaId: string) {
  const fn = useServerFn(updateTemaWikiBlockFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: { titulo?: string; itens?: WikiItem[]; ordem?: number };
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tema-wiki", temaId] }),
  });
}

export function useReorderTemaWikiBlocks(temaId: string) {
  const fn = useServerFn(reorderTemaWikiBlocksFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => fn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tema-wiki", temaId] }),
  });
}

export function useDeleteTemaWikiBlock(temaId: string) {
  const fn = useServerFn(deleteTemaWikiBlockFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tema-wiki", temaId] }),
  });
}
