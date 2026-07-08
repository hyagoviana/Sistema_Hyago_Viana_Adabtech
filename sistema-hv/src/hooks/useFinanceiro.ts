import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDashboardFinanceiroFn, listAllParcelasFn } from "@/rpc/financeiro";

export function useDashboardFinanceiro() {
  const fn = useServerFn(getDashboardFinanceiroFn);
  return useQuery({
    queryKey: ["dashboard-financeiro"],
    queryFn: () => fn(),
  });
}

export function useAllParcelas(filters?: { clientId?: string; status?: string }) {
  const fn = useServerFn(listAllParcelasFn);
  return useQuery({
    queryKey: ["all-parcelas", filters],
    queryFn: () => fn({ data: filters ?? {} }),
  });
}
