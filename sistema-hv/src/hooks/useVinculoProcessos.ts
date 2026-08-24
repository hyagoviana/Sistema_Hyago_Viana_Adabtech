// Hooks da conferência de vínculo caso ↔ processo do ProJuris.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  desvincularCasoFn,
  listCasosSemProcessoFn,
  recarregarProcessosFn,
  vincularCasoFn,
} from "@/rpc/vinculo-processos";
import type { CasoSemProcesso } from "@/lib/distribuicao/vinculo-processos";

export type { CasoSemProcesso };

const KEY = ["vinculo-processos"];

export function useCasosSemProcesso() {
  const fn = useServerFn(listCasosSemProcessoFn);
  return useQuery({
    queryKey: KEY,
    queryFn: () => fn(),
    // A listagem do ProJuris já vem de um cache de 5 min no servidor; refazer a
    // consulta a cada foco de janela só gastaria viagem.
    staleTime: 60_000,
  });
}

export function useRecarregarProcessos() {
  const fn = useServerFn(recarregarProcessosFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: (dados) => qc.setQueryData(KEY, dados),
  });
}

export function useVincularCaso() {
  const fn = useServerFn(vincularCasoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { casoId: string; codigoProcesso: number }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDesvincularCaso() {
  const fn = useServerFn(desvincularCasoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (casoId: string) => fn({ data: { casoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
