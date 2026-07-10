import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listUsersFn,
  getMyProfileFn,
  getUserReportFn,
  getUserWorkloadFn,
  reassignAndDeleteUserFn,
  inviteUserFn,
  setUserRoleFn,
  setUserStatusFn,
  removeUserFn,
  updateUserProfileFn,
} from "@/rpc/users";
import type { ReassignMapping } from "@/lib/users-service";

export function useUserReport(userId: string | null) {
  const fn = useServerFn(getUserReportFn);
  return useQuery({
    queryKey: ["user-report", userId],
    queryFn: () => fn({ data: { userId: userId! } }),
    enabled: !!userId,
  });
}

export function useMyProfile() {
  const fn = useServerFn(getMyProfileFn);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUsers() {
  const fn = useServerFn(listUsersFn);
  return useQuery({
    queryKey: ["system-users"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000, // 5 min — lista de usuários muda raramente
  });
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

// Edita nome/telefone (próprio usuário ou admin). Sem `id` → edita a si mesmo.
export function useUpdateUserProfile() {
  const fn = useServerFn(updateUserProfileFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; full_name?: string | null; phone?: string | null }) =>
      fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
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

// Carga de trabalho reatribuível (para a tela de exclusão de colaborador).
export function useUserWorkload(userId: string | null) {
  const fn = useServerFn(getUserWorkloadFn);
  return useQuery({
    queryKey: ["user-workload", userId],
    queryFn: () => fn({ data: { userId: userId! } }),
    enabled: !!userId,
  });
}

// Reatribui o trabalho e exclui o colaborador de vez (perfil + Auth).
export function useDeleteUserWithReassign() {
  const fn = useServerFn(reassignAndDeleteUserFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; mapping: ReassignMapping }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-users"] }),
  });
}
