import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  contaAzulPingFn,
  createContaAzulChargeFn,
  syncClientToContaAzulFn,
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

// ─── Health Check ────────────────────────────────────────────────────────────

export function useContaAzulPing() {
  const fn = useServerFn(contaAzulPingFn);

  return useQuery({
    queryKey: ["contaazul-ping"],
    queryFn: () => fn(),
    retry: false,
  });
}
