import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getClientPaymentStatusFn,
  getDashboardFinanceiroFn,
  getRastroFinanceiroCasoFn,
  getRelatorioFinanceiroFn,
  listAllParcelasFn,
  syncAllPagamentosFn,
} from "@/rpc/financeiro";

// F1 (AC-4) — rastro financeiro RESUMIDO de UM caso. `enabled` deve carregar só
// quem tem financeiro:view (senão o RPC devolve 403 e o hook não deve disparar).
export function useRastroFinanceiroCaso(caseId: string, enabled = true) {
  const fn = useServerFn(getRastroFinanceiroCasoFn);
  return useQuery({
    queryKey: ["rastro-financeiro-caso", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId && enabled,
    staleTime: 60 * 1000,
  });
}

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

// R4-04 (AC-3) — selo binário "Em dia / Devendo" do cliente. Endpoint LEVE
// (`requireAuth`), devolve só `{ emDia }` sem valores — usado no caminho SEM gate
// financeiro (papéis operacionais veem o selo, nunca os R$).
export function useClientPaymentStatus(clientId: string | undefined) {
  const fn = useServerFn(getClientPaymentStatusFn);
  return useQuery({
    queryKey: ["client-payment-status", clientId],
    queryFn: () => fn({ data: { clientId: clientId! } }),
    enabled: !!clientId,
    staleTime: 60 * 1000,
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
