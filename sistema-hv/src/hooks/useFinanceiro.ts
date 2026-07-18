import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getDashboardFinanceiroFn,
  getRelatorioFinanceiroFn,
  listAllParcelasFn,
  syncAllPagamentosFn,
} from "@/rpc/financeiro";

export function useRelatorioFinanceiro() {
  const fn = useServerFn(getRelatorioFinanceiroFn);
  return useQuery({
    queryKey: ["relatorio-financeiro"],
    queryFn: () => fn(),
    staleTime: 60 * 1000,
  });
}

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

export function useSyncAllPagamentos() {
  const fn = useServerFn(syncAllPagamentosFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
      qc.invalidateQueries({ queryKey: ["relatorio-financeiro"] });
      qc.invalidateQueries({ queryKey: ["all-parcelas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
    },
  });
}
