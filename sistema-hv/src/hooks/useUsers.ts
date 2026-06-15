import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listUsersFn,
  inviteUserFn,
  setUserRoleFn,
  setUserStatusFn,
  removeUserFn,
} from "@/rpc/users";

export function useUsers() {
  const fn = useServerFn(listUsersFn);
  return useQuery({ queryKey: ["system-users"], queryFn: () => fn() });
}

export function useInviteUser() {
  const fn = useServerFn(inviteUserFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; full_name?: string; role: string; redirectTo?: string }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-users"] }),
  });
}

export function useSetUserRole() {
  const fn = useServerFn(setUserRoleFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; role: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-users"] }),
  });
}

export function useSetUserStatus() {
  const fn = useServerFn(setUserStatusFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-users"] }),
  });
}

export function useRemoveUser() {
  const fn = useServerFn(removeUserFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-users"] }),
  });
}
