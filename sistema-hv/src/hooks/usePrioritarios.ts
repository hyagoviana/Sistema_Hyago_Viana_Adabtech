import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listCasosPrioritariosFn, type PrioritarioRow } from "@/rpc/prioritarios";

export type { PrioritarioRow } from "@/rpc/prioritarios";

// S6-01 — lista de casos prioritários (controladoria). Uma consulta agregada no
// servidor; a tela só filtra/ordena o que já veio.
export function useCasosPrioritarios() {
  const fn = useServerFn(listCasosPrioritariosFn);
  return useQuery<PrioritarioRow[]>({
    queryKey: ["casos-prioritarios"],
    queryFn: () => fn(),
  });
}
