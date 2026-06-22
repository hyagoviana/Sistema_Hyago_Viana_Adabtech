import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import type { FieldDefCreateInput, FieldDefUpdateInput } from "@/lib/validators/clientFields";
import {
  createClientFieldDefFn,
  deleteClientFieldDefFn,
  listClientFieldDefsFn,
  reorderClientFieldDefsFn,
  updateClientFieldDefFn,
} from "@/rpc/clientFields";

// ----------------------------------------------------------------------------
// Definições de campos customizados de cliente (Melhoria 1).
// ----------------------------------------------------------------------------
export function useClientFieldDefs() {
  const fn = useServerFn(listClientFieldDefsFn);
  return useQuery({
    queryKey: queryKeys.clientFieldDefs.all,
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateClientFieldDef() {
  const fn = useServerFn(createClientFieldDefFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FieldDefCreateInput) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientFieldDefs.all }),
  });
}

export function useUpdateClientFieldDef() {
  const fn = useServerFn(updateClientFieldDefFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: FieldDefUpdateInput }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientFieldDefs.all }),
  });
}

export function useDeleteClientFieldDef() {
  const fn = useServerFn(deleteClientFieldDefFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientFieldDefs.all }),
  });
}

export function useReorderClientFieldDefs() {
  const fn = useServerFn(reorderClientFieldDefsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => fn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientFieldDefs.all }),
  });
}
