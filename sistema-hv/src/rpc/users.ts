import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import {
  UsersServiceError,
  listUsers,
  inviteUser,
  activateUser,
  getMyProfile,
  getUserReport,
  getUserRole,
  setUserRole,
  setUserStatus,
  setUserDistribution,
  removeUser,
  getUserWorkload,
  reassignAndDeleteUser,
  type ReassignMapping,
  requestPasswordReset,
  updateUserPassword,
  clearMustChangePassword,
  adminSetUserPassword,
  updateUserProfile,
  recordConsent,
  listConsents,
  revokeConsent,
} from "@/lib/users-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireAuth();
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof UsersServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

/** Wrapper para endpoints públicos (sem requireAuth). */
async function handlePublic<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof UsersServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

// -------------------------------------------------------------- Senha ----
export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; redirectTo: string }) => d)
  .handler(async ({ data }) =>
    handlePublic(() => requestPasswordReset(data.email, data.redirectTo)),
  );

export const updatePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((d: { newPassword: string }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const user = await requireAuth();
      return updateUserPassword(user.id, data.newPassword);
    }),
  );

// Zera a marca de senha provisória do próprio usuário — chamado ao concluir a
// troca obrigatória em /nova-senha (após ele já ter definido a nova senha).
export const markPasswordChangedFn = createServerFn({ method: "POST" }).handler(async () =>
  handle(async () => {
    const me = await requireAuth();
    return clearMustChangePassword(me.id);
  }),
);

// Admin define/redefine a senha de um colaborador (tela de Permissões). Se
// `requireChange` for true, o colaborador é obrigado a trocar no próximo login.
export const adminSetUserPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; newPassword: string; requireChange?: boolean }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      if ((await getUserRole(me.id)) !== "admin") {
        throw new UsersServiceError("Apenas o administrador pode redefinir a senha.", 403);
      }
      return adminSetUserPassword(data.userId, data.newPassword, {
        requireChange: data.requireChange,
      });
    }),
  );

// -------------------------------------------------------------- Usuários ----
export const listUsersFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listUsers()),
);

// Usuários do ProJuris, para o seletor de vínculo (2026-08-27).
//
// POR QUE ISTO EXISTE. O campo do código do ProJuris era texto livre, com um
// placeholder que ensinava o formato ERRADO ("ex.: PES.0000030"). O motor faz
// `Number(...)` nesse campo, então "PES.0000040" vira NaN e a tarefa nunca é
// espelhada — em silêncio. Foi assim que 12 vínculos nasceram quebrados. Com uma
// lista real não há o que digitar errado, e quem não aparece na lista simplesmente
// não tem usuário lá.
export type ProjurisUsuario = { codigo: string; nome: string; login: string; ativo: boolean };

export const listProjurisUsuariosFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<ProjurisUsuario[]> => {
    await requireModule("sistema", "view");
    const { createProjurisClientFromEnv } = await import("@/lib/projuris/client");
    const client = createProjurisClientFromEnv();
    await client.authenticateTryingVariants();
    const r = (await client.projurisPostConsulta("usuario/consulta", {
      quantidadeRegistros: 500,
      registroInicial: 0,
    })) as { usuarioConsultaResultadoWs?: Array<Record<string, unknown>> };

    return (
      (r.usuarioConsultaResultadoWs ?? [])
        .map((u) => ({
          codigo: String(u.codigoUsuario ?? ""),
          nome: String(u.nomeUsuario ?? "").trim(),
          login: String(u.login ?? ""),
          ativo: Boolean(u.habilitado),
        }))
        .filter((u) => u.codigo)
        // Habilitados primeiro: são os que interessam para quem está vinculando
        // alguém agora. Os desabilitados ficam no fim, mas continuam escolhíveis —
        // ex-funcionário precisa manter o vínculo histórico.
        .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
    );
  }),
);

// Perfil do próprio usuário autenticado (para editar nome/telefone).
export const getMyProfileFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async () => {
    const me = await requireAuth();
    return getMyProfile(me.id);
  }),
);

// M8 — cadastro do colaborador (perfil/cargo/unidade + 2 flags do motor),
// compartilhado entre convite e edição.
type CadastroColaboradorInput = {
  perfil?: string | null;
  cargo?: string | null;
  unidade_organizacional?: string | null;
  peticionante?: boolean;
  participa_distribuicao_padrao?: boolean;
  status_projuris?: string | null;
};

export const inviteUserFn = createServerFn({ method: "POST" })
  .inputValidator(
    (
      d: {
        email: string;
        full_name?: string;
        role: string;
        redirectTo?: string;
      } & CadastroColaboradorInput,
    ) => d,
  )
  .handler(async ({ data }) => handle(() => inviteUser(data)));

// Ativa o próprio usuário autenticado após ele definir a senha (convite aceito).
export const activateUserFn = createServerFn({ method: "POST" }).handler(async () =>
  handle(async () => {
    const me = await requireAuth();
    return activateUser(me.id);
  }),
);

// Edita nome/telefone de um usuário. Autorização: o PRÓPRIO usuário ou um admin.
export const updateUserProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    (
      d: {
        id?: string;
        full_name?: string | null;
        phone?: string | null;
      } & CadastroColaboradorInput,
    ) => d,
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      const targetId = data.id ?? me.id;
      const isSelf = targetId === me.id;
      if (!isSelf) {
        const myRole = await getUserRole(me.id);
        if (myRole !== "admin") {
          throw new UsersServiceError("Sem permissão para editar outro usuário.", 403);
        }
      }
      // M8 — os campos de CADASTRO (perfil/cargo/unidade/flags do motor) só o
      // admin grava; o próprio usuário edita apenas nome/telefone (auto-serviço).
      const isAdmin = isSelf ? (await getUserRole(me.id)) === "admin" : true;
      return updateUserProfile(targetId, {
        full_name: data.full_name,
        phone: data.phone,
        ...(isAdmin
          ? {
              perfil: data.perfil,
              cargo: data.cargo,
              unidade_organizacional: data.unidade_organizacional,
              peticionante: data.peticionante,
              participa_distribuicao_padrao: data.participa_distribuicao_padrao,
              status_projuris: data.status_projuris,
            }
          : {}),
      });
    }),
  );

// Carga de trabalho reatribuível de um usuário (para a tela de exclusão). Admin.
export const getUserWorkloadFn = createServerFn({ method: "GET" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      if ((await getUserRole(me.id)) !== "admin") {
        throw new UsersServiceError("Apenas o administrador pode excluir colaboradores.", 403);
      }
      return getUserWorkload(data.userId);
    }),
  );

// Reatribui o trabalho e EXCLUI o colaborador de vez (perfil + Auth). Admin.
export const reassignAndDeleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; mapping: ReassignMapping }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      if ((await getUserRole(me.id)) !== "admin") {
        throw new UsersServiceError("Apenas o administrador pode excluir colaboradores.", 403);
      }
      return reassignAndDeleteUser(data.userId, data.mapping, me.id);
    }),
  );

// Relatório de tudo vinculado a um usuário. Autorização: admin ou o próprio.
export const getUserReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      if (data.userId !== me.id) {
        const myRole = await getUserRole(me.id);
        if (myRole !== "admin") {
          throw new UsersServiceError("Sem permissão para ver este usuário.", 403);
        }
      }
      return getUserReport(data.userId);
    }),
  );

export const setUserRoleFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; role: string }) => d)
  .handler(async ({ data }) => handle(() => setUserRole(data.id, data.role)));

export const setUserStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => handle(() => setUserStatus(data.id, data.status)));

// Configura a distribuição (ProJuris) de um usuário (H5). Gate admin — mesmo
// padrão de setUserRoleFn/reassignAndDeleteUserFn.
export const setUserDistributionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      projuris_responsavel_id?: string | null;
      participa?: boolean;
      weight?: number | null;
      eligible_complex?: boolean | null;
    }) => d,
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const me = await requireAuth();
      if ((await getUserRole(me.id)) !== "admin") {
        throw new UsersServiceError("Apenas o administrador pode configurar a distribuição.", 403);
      }
      return setUserDistribution(data.id, {
        projuris_responsavel_id: data.projuris_responsavel_id,
        participa: data.participa,
        weight: data.weight,
        eligible_complex: data.eligible_complex,
      });
    }),
  );

export const removeUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handle(() => removeUser(data.id)));

// ------------------------------------------------------------- LGPD ----
export const recordConsentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      client_id?: string | null;
      cpf_cnpj?: string | null;
      finalidade: string;
      channel?: string | null;
      policy_version?: string;
    }) => d,
  )
  .handler(async ({ data }) => handle(() => recordConsent(data)));

export const listConsentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { clientId: string }) => d)
  .handler(async ({ data }) => handle(() => listConsents(data.clientId)));

export const revokeConsentFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; reason?: string }) => d)
  .handler(async ({ data }) => handle(() => revokeConsent(data.id, data.reason)));
