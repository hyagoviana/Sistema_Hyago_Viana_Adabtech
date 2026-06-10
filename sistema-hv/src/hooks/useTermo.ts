import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  aceitarTermoFn,
  apresentarTermoFn,
  aprovarTermoManualFn,
  calcularTermoFn,
  conferirTermoFn,
  createTermoFn,
  enviarParaConferenciaFn,
  listParcelasFn,
  listTermosFn,
  recusarTermoFn,
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
      },
    ) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
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
