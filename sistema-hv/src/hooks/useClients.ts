import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import type { ClientCreateInput, ClientUpdateInput } from "@/lib/validators/client";
import {
  createClientFn,
  findOrCreateClientFn,
  getClientFn,
  hardDeleteClientFn,
  listClientsByLifecycleFn,
  listClientsFn,
  resyncDriveFn,
  tornarClienteFn,
  updateClientCustomFieldsFn,
  updateClientFn,
} from "@/rpc/clients";

export type LifecycleTab = "lead" | "cliente" | "perdido";

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------
export function useClientsList(search?: string) {
  const fn = useServerFn(listClientsFn);
  return useQuery({
    queryKey: queryKeys.clients.list(search),
    queryFn: () => fn({ data: search ? { search } : undefined }),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

// S1-05 — lista de pessoas por lifecycle (abas Leads / Clientes / Perdidos).
export function useClientsByLifecycle(tab: LifecycleTab) {
  const fn = useServerFn(listClientsByLifecycleFn);
  return useQuery({
    queryKey: [...queryKeys.clients.all, "lifecycle", tab],
    queryFn: () => fn({ data: { tab } }),
    staleTime: 60 * 1000,
  });
}

export function useClient(id: string) {
  const fn = useServerFn(getClientFn);
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => fn({ data: { id } }),
    enabled: !!id,
  });
}

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------
export function useCreateClient() {
  const fn = useServerFn(createClientFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientCreateInput) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() });
    },
  });
}

// S1-04 — find-or-create por CPF (entrada comercial). Reutiliza pessoa existente
// em vez de estourar erro de unicidade; retorna { client, created, conflitos }.
export function useFindOrCreateClient() {
  const fn = useServerFn(findOrCreateClientFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientCreateInput) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() });
    },
  });
}

export function useUpdateClient() {
  const fn = useServerFn(updateClientFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: ClientUpdateInput }) => fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.clients.detail(vars.id) });
    },
  });
}

// Campos personalizados do cliente (JSONB) — campos de TEMA com scope='cliente'.
// Invalida a ficha do cliente E a lista de casos (a Lista lê custom_fields do
// cliente por linha para exibir/filtrar esses campos).
export function useUpdateClientCustomFields() {
  const fn = useServerFn(updateClientCustomFieldsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: Record<string, string | number | boolean | string[] | null>;
    }) => fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.all });
    },
  });
}

// HARD-DELETE — exclusão PERMANENTE (apaga cliente + casos + docs + notas).
export function useDeleteClient() {
  const fn = useServerFn(hardDeleteClientFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() });
    },
  });
}

export function useResyncDrive() {
  const fn = useServerFn(resyncDriveFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() });
    },
  });
}

// Botão "Tornar esse lead um cliente" — marca a pessoa como cliente.
export function useTornarCliente() {
  const fn = useServerFn(tornarClienteFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() });
    },
  });
}
