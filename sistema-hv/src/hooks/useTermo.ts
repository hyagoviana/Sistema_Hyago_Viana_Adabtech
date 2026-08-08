import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  aceitarTermoFn,
  apresentarTermoFn,
  aprovarTermoManualFn,
  calcularTermoFn,
  conferirTermoFn,
  createTermoFn,
  darBaixaParcelaFn,
  deleteAllParcelasFn,
  deleteParcelaFn,
  deleteTermoAdminFn,
  deleteTermoRascunhoFn,
  enviarParaConferenciaFn,
  estornarParcelaFn,
  gerarDocumentoTermoFn,
  getCaseHonorariosFn,
  listParcelasFn,
  listTermosFn,
  recusarTermoFn,
  setParcelaContaAzulFaturaFn,
} from "@/rpc/termo";

export type TermoCalcInput = {
  saldoAntesCentavos: number;
  saldoDepoisCentavos: number;
  parcelasPagasCentavos?: number;
  percentual?: number;
  valorParcelaCentavos?: number;
  descontoAvistaPct?: number;
};

export function useTermos(caseId: string) {
  const fn = useServerFn(listTermosFn);
  return useQuery({
    queryKey: ["termos", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

// S7-02 — honorários persistidos da procuração (pré-preenche a elaboração).
export function useCaseHonorarios(caseId: string) {
  const fn = useServerFn(getCaseHonorariosFn);
  return useQuery({
    queryKey: ["case-honorarios", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useCalcTermo() {
  const fn = useServerFn(calcularTermoFn);
  return useMutation({ mutationFn: (input: TermoCalcInput) => fn({ data: input }) });
}

export function useCreateTermo(caseId: string) {
  const fn = useServerFn(createTermoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: TermoCalcInput & {
        caseId: string;
        formaPagamento?: "PARCELADO" | "A_VISTA";
        tipoTermo?: "PARCIAL" | "COMPLEMENTAR";
        elaboradoPorId?: string | null;
        remanescenteAnteriorCentavos?: number | null;
      },
    ) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}

// S6-04 — gera o documento editável do termo e grava o link no snapshot.
export function useGerarDocumentoTermo(caseId: string) {
  const fn = useServerFn(gerarDocumentoTermoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      termoId: string;
      remanescenteAnteriorCentavos?: number;
      saldoAtualCentavos?: number;
      percentualAbatimento?: number;
      saldoOriginarioCentavos?: number;
      saldoEpocaAbatimentoCentavos?: number;
      taxaJuros?: string;
      percentualFinanciado?: string;
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}

export function useDeleteTermo(caseId: string) {
  const fn = useServerFn(deleteTermoRascunhoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termoId: string) => fn({ data: { termoId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termos", caseId] });
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
    },
  });
}

export function useDeleteTermoAdmin(caseId: string) {
  const fn = useServerFn(deleteTermoAdminFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termoId: string) => fn({ data: { termoId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termos", caseId] });
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["parcelas", caseId] });
    },
  });
}

export function useEnviarConferencia(caseId: string) {
  const fn = useServerFn(enviarParaConferenciaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termoId: string) => fn({ data: { termoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}

export function useConferirTermo(caseId: string) {
  const fn = useServerFn(conferirTermoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { termoId: string; conferidoPorId: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}

export function useAprovarTermo(caseId: string) {
  const fn = useServerFn(aprovarTermoManualFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { termoId: string; aprovadoPorId: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}

export function useApresentarTermo(caseId: string) {
  const fn = useServerFn(apresentarTermoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termoId: string) => fn({ data: { termoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}

export function useAceitarTermo(caseId: string) {
  const fn = useServerFn(aceitarTermoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termoId: string) => fn({ data: { termoId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termos", caseId] });
      qc.invalidateQueries({ queryKey: ["parcelas", caseId] });
      qc.invalidateQueries({ queryKey: ["case"] });
    },
  });
}

export function useRecusarTermo(caseId: string) {
  const fn = useServerFn(recusarTermoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termoId: string) => fn({ data: { termoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}

export function useParcelas(caseId: string) {
  const fn = useServerFn(listParcelasFn);
  return useQuery({
    queryKey: ["parcelas", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useDarBaixaParcela(caseId: string) {
  const fn = useServerFn(darBaixaParcelaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      parcelaId: string;
      valorPagoCentavos: number;
      dataPagamento?: string | null;
      metodoPagamento?: string | null;
    }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parcelas", caseId] });
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    },
  });
}

export function useEstornarParcela(caseId: string) {
  const fn = useServerFn(estornarParcelaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parcelaId: string) => fn({ data: { parcelaId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parcelas", caseId] });
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    },
  });
}

// (item 5) — excluir parcela / todas as parcelas do caso.
export function useDeleteParcela(caseId: string) {
  const fn = useServerFn(deleteParcelaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parcelaId: string) => fn({ data: { parcelaId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parcelas", caseId] });
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    },
  });
}

// M6 (2026-08-07) — grava/limpa o nº da fatura do Conta Azul de uma parcela.
export function useSetParcelaContaAzulFatura(caseId: string) {
  const fn = useServerFn(setParcelaContaAzulFaturaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { parcelaId: string; faturaNumero: string | null }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parcelas", caseId] });
    },
  });
}

export function useDeleteAllParcelas(caseId: string) {
  const fn = useServerFn(deleteAllParcelasFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { caseId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parcelas", caseId] });
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    },
  });
}
