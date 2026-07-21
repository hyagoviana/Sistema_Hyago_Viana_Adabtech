import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  cancelContaAzulChargeFn,
  contaAzulPingFn,
  createContaAzulChargeFn,
  syncClientToContaAzulFn,
  syncContaAzulPagamentosFn,
} from "@/rpc/contaazul";

// ─── Sync Cliente → Conta Azul ───────────────────────────────────────────────

export function useSyncClientToContaAzul() {
  const fn = useServerFn(syncClientToContaAzulFn);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => fn({ data: { clientId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ─── Criar Cobrança ──────────────────────────────────────────────────────────

export function useCreateContaAzulCharge() {
  const fn = useServerFn(createContaAzulChargeFn);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      caseId: string;
      paymentMethod: string;
      value: number;
      dueDate: string;
      description?: string;
      installmentCount?: number;
    }) => fn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
    },
  });
}

// ─── Sync de Pagamentos (manual — o cron das 08:30 chama o mesmo motor) ──────

export function useSyncContaAzulPagamentos() {
  const fn = useServerFn(syncContaAzulPagamentosFn);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (caseId?: string) => fn({ data: caseId ? { caseId } : {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    },
  });
}

// ─── Cancelar Cobrança ──────────────────────────────────────────────────────

export function useCancelContaAzulCharge() {
  const fn = useServerFn(cancelContaAzulChargeFn);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (parcelaId: string) => fn({ data: { parcelaId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
    },
  });
}

// ─── Health Check ────────────────────────────────────────────────────────────

export function useContaAzulPing() {
  const fn = useServerFn(contaAzulPingFn);

  return useQuery({
    queryKey: ["contaazul-ping"],
    queryFn: () => fn(),
    retry: false,
  });
}
