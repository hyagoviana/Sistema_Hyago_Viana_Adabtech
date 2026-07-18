import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyModulePermsFn } from "@/rpc/permissions";

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
