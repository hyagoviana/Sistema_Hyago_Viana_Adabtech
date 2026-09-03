import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  getRoleModuleDefaults,
  listRoleModulePerms,
  setRoleModulePerms,
  getUserModulePerms,
  getUserModuleValues,
  setUserModulePerms,
} from "@/lib/rbac-perms-service";
import { MODULES, type Module, type ModuleAccess } from "@/lib/rbac";
import { AuthError, requireAuth, requireRole } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

/**
 * Overrides de módulo do usuário LOGADO (R3-01, AC-5). Sem override configurado
 * ⇒ `{}` (o front cai no papel via `permissaoEfetiva`). Consumido pelas stories
 * R3-02/R3-04/R3-05.
 */
export const getMyModulePermsFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<Partial<Record<Module, ModuleAccess>>> => {
    const { id } = await requireAuth();

    // S5-01 — o front precisa enxergar a MESMA régua do servidor. Devolvemos o
    // padrão do PAPEL (matriz, quando existe) já mesclado com os overrides do
    // usuário, nesta ordem de precedência:
    //     override do usuário  >  padrão do papel  >  mapa derivado do rbac.ts
    // Papel sem linhas na tabela ⇒ nada é mesclado ⇒ o front cai no derivado,
    // exatamente como antes. Sem isto, a UI e o servidor divergiriam para os
    // papéis novos (botão aparece e a ação dá 403, ou o contrário).
    const sb = getSupabaseAdmin();
    const { data: usuario } = await sb
      .from("system_users")
      .select("role")
      .eq("id", id)
      .maybeSingle();

    const [padraoDoPapel, overrides] = await Promise.all([
      getRoleModuleDefaults((usuario as { role?: string } | null)?.role),
      getUserModulePerms(id),
    ]);

    return { ...padraoDoPapel, ...overrides };
  }),
);

// Fase B — overrides da chave "ver valores" do usuário LOGADO.
export const getMyModuleValuesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<Partial<Record<Module, boolean>>> => {
    const { id } = await requireAuth();
    return getUserModuleValues(id);
  }),
);

export type AdminUserPerms = {
  access: Partial<Record<Module, ModuleAccess>>;
  values: Partial<Record<Module, boolean>>;
};

// ADMIN — lê os overrides (acesso + chave de valores) de um usuário QUALQUER
// (para editar na tela de permissões / no convite). Gate: só admin.
export const getUserModulePermsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<AdminUserPerms> => {
      await requireRole(["admin"]);
      const [access, values] = await Promise.all([
        getUserModulePerms(data.userId),
        getUserModuleValues(data.userId),
      ]);
      return { access, values };
    }),
  );

// ADMIN — grava os overrides por módulo de um usuário: `access` (none/view/edit ou
// null=padrão) e `values` (chave "ver valores": true/false ou null=padrão). Gate:
// só admin.
const setPermsSchema = z.object({
  userId: z.string().uuid(),
  access: z
    .record(z.enum(MODULES), z.enum(["none", "view", "edit", "configure"]).nullable())
    .optional(),
  values: z.record(z.enum(MODULES), z.boolean().nullable()).optional(),
});

export const setUserModulePermsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setPermsSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<{ ok: true }> => {
      await requireRole(["admin"]);
      await setUserModulePerms(data.userId, {
        access: data.access as Partial<Record<Module, ModuleAccess | null>> | undefined,
        values: data.values as Partial<Record<Module, boolean | null>> | undefined,
      });
      return { ok: true };
    }),
  );

// ---------------------------------------------------------------------------
// S5-02 — PADRÃO POR PAPEL (a matriz do Thiago).
//
// Thiago: "eu acho que a gente precisava de um menu de permissão do perfil, onde
// a gente pode configurar o que que o perfil em si vai ver". Adavio: "ele quer
// para todo o perfil, que hoje ele consegue editar para um usuário. Não para todo
// o papel."
// ---------------------------------------------------------------------------
export type RolePermsMatriz = {
  linhas: Array<{ role: string; module: Module; access: ModuleAccess }>;
  /** Quantos usuários ATIVOS têm cada papel — a tela mostra o alcance da mudança. */
  usuariosPorPapel: Record<string, number>;
};

export const getRolePermsMatrizFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<RolePermsMatriz> => {
    await requireRole(["admin"]);
    const sb = getSupabaseAdmin();
    const [linhas, { data: usuarios }] = await Promise.all([
      listRoleModulePerms(),
      sb.from("system_users").select("role, status").is("deleted_at", null),
    ]);
    const usuariosPorPapel: Record<string, number> = {};
    for (const u of (usuarios ?? []) as Array<{ role: string; status: string }>) {
      if (u.status === "SUSPENDED" || u.status === "ARCHIVED") continue;
      usuariosPorPapel[u.role] = (usuariosPorPapel[u.role] ?? 0) + 1;
    }
    return { linhas, usuariosPorPapel };
  }),
);

const setRolePermsSchema = z.object({
  role: z.string().min(1),
  access: z.record(z.enum(MODULES), z.enum(["none", "view", "edit", "configure"]).nullable()),
});

export const setRolePermsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setRolePermsSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<{ ok: true }> => {
      const admin = await requireRole(["admin"]);

      // Guarda contra auto-bloqueio: um admin não pode tirar do próprio papel o
      // acesso ao módulo `sistema` — ficaria sem como voltar atrás pela tela.
      const sb = getSupabaseAdmin();
      const { data: eu } = await sb
        .from("system_users")
        .select("role")
        .eq("id", admin.id)
        .maybeSingle();
      const meuPapel = (eu as { role?: string } | null)?.role;
      const novoSistema = (data.access as Record<string, string | null>).sistema;
      if (
        meuPapel &&
        meuPapel === data.role &&
        novoSistema !== undefined &&
        novoSistema !== null &&
        novoSistema !== "configure"
      ) {
        setResponseStatus(422);
        throw new Error(
          "Você não pode reduzir o acesso ao módulo Sistema do seu próprio papel — ficaria sem como desfazer.",
        );
      }

      await setRoleModulePerms(
        data.role,
        data.access as Partial<Record<Module, ModuleAccess | null>>,
      );

      await sb.from("system_audit_log").insert({
        organization_id: "00000000-0000-0000-0000-000000000001",
        action: "role_perms.updated",
        entity_type: "role",
        // A "entidade" aqui é o papel, que não tem UUID — o id vai no diff.
        entity_id: "00000000-0000-0000-0000-000000000000",
        diff: { role: data.role, access: data.access, by: admin.id },
      });

      return { ok: true };
    }),
  );
