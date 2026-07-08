import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  asaasPingFn,
  cancelChargeFn,
  createChargeFn,
  getChargeStatusFn,
  getPixQrCodeFn,
  listClientChargesFn,
  syncClientToAsaasFn,
} from "@/rpc/asaas";

// ─── Sync Cliente → Asaas ────────────────────────────────────────────────────

export function useSyncClientToAsaas() {
  const fn = useServerFn(syncClientToAsaasFn);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => fn({ data: { clientId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ─── Criar Cobrança ──────────────────────────────────────────────────────────

export function useCreateCharge() {
  const fn = useServerFn(createChargeFn);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      caseId: string;
      billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
      value: number;
      dueDate: string;
      description?: string;
      installmentCount?: number;
    }) => fn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["asaas-charges"] });
    },
  });
}

// ─── Status da Cobrança ──────────────────────────────────────────────────────

export function useChargeStatus(parcelaId: string | undefined) {
  const fn = useServerFn(getChargeStatusFn);

  return useQuery({
    queryKey: ["asaas-charge-status", parcelaId],
    queryFn: () => fn({ data: { parcelaId: parcelaId! } }),
    enabled: !!parcelaId,
  });
}

// ─── Pix QR Code ─────────────────────────────────────────────────────────────

export function usePixQrCode(parcelaId: string | undefined) {
  const fn = useServerFn(getPixQrCodeFn);

  return useQuery({
    queryKey: ["asaas-pix-qrcode", parcelaId],
    queryFn: () => fn({ data: { parcelaId: parcelaId! } }),
    enabled: !!parcelaId,
  });
}

// ─── Cancelar Cobrança ───────────────────────────────────────────────────────

export function useCancelCharge() {
  const fn = useServerFn(cancelChargeFn);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (parcelaId: string) => fn({ data: { parcelaId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["asaas-charges"] });
    },
  });
}

// ─── Listar Cobranças do Cliente ─────────────────────────────────────────────

export function useClientCharges(clientId: string | undefined) {
  const fn = useServerFn(listClientChargesFn);

  return useQuery({
    queryKey: ["asaas-charges", clientId],
    queryFn: () => fn({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });
}

// ─── Health Check ────────────────────────────────────────────────────────────

export function useAsaasPing() {
  const fn = useServerFn(asaasPingFn);

  return useQuery({
    queryKey: ["asaas-ping"],
    queryFn: () => fn(),
    retry: false,
  });
}
