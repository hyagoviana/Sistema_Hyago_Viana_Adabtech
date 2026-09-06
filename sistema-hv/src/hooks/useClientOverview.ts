// S3-04 — a visão 360 do cliente numa consulta só.
//
// Uma chamada traz casos, etapas (operacional, financeira e comercial) e o
// resumo financeiro de cada um. Antes a ficha montava isso a partir de várias
// fontes, e o financeiro do cliente era uma ilha separada dos casos.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { ClientOverview } from "@/lib/client-overview-service";
import { clientOverviewFn } from "@/rpc/client-overview";

export type { CasoDoCliente, ResumoValores } from "@/lib/client-overview-service";

export function useClientOverview(clientId: string | null | undefined) {
  const fn = useServerFn(clientOverviewFn);
  return useQuery({
    queryKey: ["client-overview", clientId ?? "none"],
    queryFn: () =>
      fn({ data: { clientId: clientId! } }) as Promise<
        ClientOverview & { podeVerValores: boolean }
      >,
    enabled: !!clientId,
    staleTime: 30 * 1000,
  });
}
