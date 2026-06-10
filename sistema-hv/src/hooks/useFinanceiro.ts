import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDashboardFinanceiroFn } from "@/rpc/financeiro";

export function useDashboardFinanceiro() {
  const fn = useServerFn(getDashboardFinanceiroFn);
  return useQuery({
    queryKey: ["dashboard-financeiro"],
    queryFn: () => fn(),
  });
}
