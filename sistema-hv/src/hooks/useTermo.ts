import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { calcularTermoFn, createTermoFn, listTermosFn } from "@/rpc/termo";

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
    mutationFn: (input: TermoCalcInput & {
      caseId: string;
      formaPagamento?: "PARCELADO" | "A_VISTA";
      tipoTermo?: "PARCIAL" | "COMPLEMENTAR";
      elaboradoPorId?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["termos", caseId] }),
  });
}
