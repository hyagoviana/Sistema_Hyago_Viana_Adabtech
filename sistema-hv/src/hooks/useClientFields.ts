import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import type { FieldDefCreateInput, FieldDefUpdateInput } from "@/lib/validators/clientFields";
import {
  createClientFieldDefFn,
  deleteClientFieldDefFn,
  listClientFieldDefsFn,
  listClientFieldTemaLinksFn,
  reorderClientFieldDefsFn,
  setClientFieldActiveFn,
  setClientFieldTemaLinksFn,
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

export function useSetClientFieldActive() {
  const fn = useServerFn(setClientFieldActiveFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientFieldDefs.all }),
  });
}

// ----------------------------------------------------------------------------
// B1 (2026-08-05) — vínculo campo-do-cliente → tema(s).
// ----------------------------------------------------------------------------
export function useClientFieldTemaLinks(clientFieldDefId: string | null | undefined) {
  const fn = useServerFn(listClientFieldTemaLinksFn);
  return useQuery({
    queryKey: ["client-field-tema-links", clientFieldDefId],
    queryFn: () => fn({ data: { clientFieldDefId: clientFieldDefId as string } }),
    enabled: !!clientFieldDefId,
    staleTime: 60 * 1000,
  });
}

export function useSetClientFieldTemaLinks() {
  const fn = useServerFn(setClientFieldTemaLinksFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { clientFieldDefId: string; temaIds: string[] }) => fn({ data: vars }),
    // Invalida o campo do cliente, o vínculo e as defs de tema (para os painéis de
    // filtro/coluna refletirem a def-espelho na hora).
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.clientFieldDefs.all });
      qc.invalidateQueries({ queryKey: ["client-field-tema-links", vars.clientFieldDefId] });
      qc.invalidateQueries({ queryKey: ["temas"] });
      qc.invalidateQueries({ queryKey: ["tema-field-defs"] });
      qc.invalidateQueries({ queryKey: ["tema-field-defs-admin"] });
    },
  });
}
