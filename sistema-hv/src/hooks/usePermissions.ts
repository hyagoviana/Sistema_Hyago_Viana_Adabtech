import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { Module, ModuleAccess } from "@/lib/rbac";
import {
  getMyModulePermsFn,
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

/** ADMIN — grava os overrides por módulo de um usuário. */
export function useSetUserModulePerms() {
  const fn = useServerFn(setUserModulePermsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      userId: string;
      perms: Partial<Record<Module, ModuleAccess | null>>;
    }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["user-module-perms", vars.userId] });
      qc.invalidateQueries({ queryKey: ["my-module-perms"] });
    },
  });
}
