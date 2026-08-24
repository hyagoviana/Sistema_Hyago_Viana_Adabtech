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
  setUserDistributionFn,
  removeUserFn,
  updateUserProfileFn,
  adminSetUserPasswordFn,
  requestPasswordResetFn,
} from "@/rpc/users";
import type { ReassignMapping } from "@/lib/users-service";

// M8 — campos de cadastro do colaborador (perfil/cargo/unidade + flags do motor),
// aceitos tanto no convite quanto na edição.
type CadastroColaboradorVars = {
  perfil?: string | null;
  cargo?: string | null;
  unidade_organizacional?: string | null;
  peticionante?: boolean;
  participa_distribuicao_padrao?: boolean;
  status_projuris?: string | null;
};

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

// Usuários ATRIBUÍVEIS — só quem está ativo no sistema (ACTIVE ou INVITED).
// Reunião 2026-08-19 (Thiago): os seletores de responsável traziam TODOS os
// usuários, inclusive os ARCHIVED/SUSPENDED herdados do ProJuris, poluindo a
// lista na hora de criar tarefa. A gestão de usuários (UsersAdmin) continua com
// `useUsers()` — lá arquivado/suspenso PRECISA aparecer. Mesma queryKey ⇒ o
// cache é compartilhado; o recorte acontece só neste observador (`select`).
export function useAssignableUsers() {
  const fn = useServerFn(listUsersFn);
  return useQuery({
    queryKey: ["system-users"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
    select: (rows) => rows.filter((u) => u.status === "ACTIVE" || u.status === "INVITED"),
  });
}

export function useInviteUser() {
  const fn = useServerFn(inviteUserFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: {
        email: string;
        full_name?: string;
        role: string;
        redirectTo?: string;
      } & CadastroColaboradorVars,
    ) => fn({ data: input }),
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
    mutationFn: (
      vars: {
        id?: string;
        full_name?: string | null;
        phone?: string | null;
      } & CadastroColaboradorVars,
    ) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// Configura a distribuição (ProJuris) de um usuário: ID ProJuris, participa,
// peso e elegibilidade a tarefas complexas (H5). Admin-only no servidor.
export function useSetUserDistribution() {
  const fn = useServerFn(setUserDistributionFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      projuris_responsavel_id?: string | null;
      participa?: boolean;
      weight?: number | null;
      eligible_complex?: boolean | null;
    }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-users"] });
      qc.invalidateQueries({ queryKey: ["executor-mappings"] });
    },
  });
}

// Admin define/redefine a senha de um colaborador (tela de Permissões).
export function useAdminSetUserPassword() {
  const fn = useServerFn(adminSetUserPasswordFn);
  return useMutation({
    mutationFn: (vars: { userId: string; newPassword: string; requireChange?: boolean }) =>
      fn({ data: vars }),
  });
}

// Dispara o e-mail de redefinição de senha (link → /nova-senha) para um e-mail.
export function useRequestPasswordReset() {
  const fn = useServerFn(requestPasswordResetFn);
  return useMutation({
    mutationFn: (vars: { email: string; redirectTo: string }) => fn({ data: vars }),
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
