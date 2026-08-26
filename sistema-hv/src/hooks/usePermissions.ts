import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/lib/auth";
import { permissaoEfetiva, type Module, type ModuleAccess } from "@/lib/rbac";
import {
  getMyModulePermsFn,
  getMyModuleValuesFn,
  getUserModulePermsFn,
  setUserModulePermsFn,
} from "@/rpc/permissions";

/**
 * Overrides de permissão por módulo do usuário logado (R3-01, AC-5).
 * Sem override configurado ⇒ `{}` (o consumidor cai no papel via
 * `permissaoEfetiva`). Consumido pelas stories R3-02/R3-04/R3-05.
 */
export function useMyModulePerms() {
  const fn = useServerFn(getMyModulePermsFn);
  return useQuery({
    queryKey: ["my-module-perms"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000, // 5 min — overrides mudam raramente
  });
}

/**
 * Fase B — overrides da chave "ver valores" do usuário logado. Consumido pelos
 * gates de $ (via `podeVerValores`). `{}` ⇒ cai no padrão do papel.
 */
export function useMyModuleValues() {
  const fn = useServerFn(getMyModuleValuesFn);
  return useQuery({
    queryKey: ["my-module-values"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Gate de EDIÇÃO no FRONT (2026-07-19) — o usuário logado pode ESCREVER (criar/
 * editar/mover/excluir) no módulo? Combina papel + overrides via `permissaoEfetiva`
 * (mesma régua do servidor `requireModule(module,'edit')`). Use para esconder/
 * desabilitar botões de escrita; o servidor é a proteção real.
 */
export function usePodeEditar(module: Module): boolean {
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  return permissaoEfetiva(role, perms ?? {}, module, "edit");
}

/**
 * Gate de LEITURA no front (AU1) — espelha `requireModule(module, "view")`. Use
 * para esconder painéis inteiros (ex.: auditoria dentro do caso); o servidor
 * continua sendo a proteção real.
 */
export function usePodeVer(module: Module): boolean {
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  return permissaoEfetiva(role, perms ?? {}, module, "view");
}

/** Igual a `usePodeEditar`, mas true se puder editar QUALQUER um dos módulos
 * (entidades compartilhadas: cliente/caso valem para comercial OU operacional). */
export function usePodeEditarAlgum(modules: Module[]): boolean {
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  return modules.some((m) => permissaoEfetiva(role, perms ?? {}, m, "edit"));
}

/**
 * ADMIN — overrides por módulo de um usuário específico (para editar na tela de
 * permissões). Só busca quando há `userId`.
 */
export function useUserModulePerms(userId: string | null | undefined) {
  const fn = useServerFn(getUserModulePermsFn);
  return useQuery({
    queryKey: ["user-module-perms", userId],
    queryFn: () => fn({ data: { userId: userId! } }),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

/** ADMIN — grava os overrides por módulo de um usuário (acesso + chave de valores). */
export function useSetUserModulePerms() {
  const fn = useServerFn(setUserModulePermsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      userId: string;
      access?: Partial<Record<Module, ModuleAccess | null>>;
      values?: Partial<Record<Module, boolean | null>>;
    }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["user-module-perms", vars.userId] });
      qc.invalidateQueries({ queryKey: ["my-module-perms"] });
      qc.invalidateQueries({ queryKey: ["my-module-values"] });
    },
  });
}
