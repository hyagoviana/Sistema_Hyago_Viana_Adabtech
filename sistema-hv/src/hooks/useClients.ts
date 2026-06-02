import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import type { ClientCreateInput, ClientUpdateInput } from "@/lib/validators/client";
import {
  createClientFn,
  getClientFn,
  listClientsFn,
  resyncDriveFn,
  softDeleteClientFn,
  updateClientFn,
} from "@/rpc/clients";

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------
export function useClientsList(search?: string) {
  const fn = useServerFn(listClientsFn);
  return useQuery({
    queryKey: queryKeys.clients.list(search),
    queryFn: () => fn({ data: search ? { search } : undefined }),
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

export function useDeleteClient() {
  const fn = useServerFn(softDeleteClientFn);
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
