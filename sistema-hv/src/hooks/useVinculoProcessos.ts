// Hooks da conferência de vínculo caso ↔ processos do ProJuris.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  buscarProcessoFn,
  definirPrincipalFn,
  desvincularProcessoFn,
  listCasosComProcessosFn,
  listProcessosDoCasoFn,
  recarregarProcessosFn,
  vincularProcessoFn,
} from "@/rpc/vinculo-processos";
import type {
  CasoComProcessos,
  ProcessoCandidato,
  ProcessoVinculado,
} from "@/lib/distribuicao/vinculo-processos";

export type { CasoComProcessos, ProcessoCandidato, ProcessoVinculado };

const KEY = ["vinculo-processos"];

/** Chave por caso — a ficha do caso e a tela da controladoria se invalidam juntas. */
const keyCaso = (casoId: string) => ["processos-do-caso", casoId];

/** Processos de um caso, para a aba Judicial. Só banco: responde na hora. */
export function useProcessosDoCaso(casoId: string) {
  const fn = useServerFn(listProcessosDoCasoFn);
  return useQuery({
    queryKey: keyCaso(casoId),
    queryFn: () => fn({ data: { casoId } }),
    enabled: Boolean(casoId),
  });
}

export function useCasosComProcessos(somentePendentes = true) {
  const fn = useServerFn(listCasosComProcessosFn);
  return useQuery({
    queryKey: [...KEY, somentePendentes],
    queryFn: () => fn({ data: { somentePendentes } }),
    // A listagem do ProJuris já vem de um cache de 15 min no servidor; refazer a
    // consulta a cada foco de janela só gastaria viagem.
    staleTime: 60_000,
  });
}

export function useRecarregarProcessos(somentePendentes = true) {
  const fn = useServerFn(recarregarProcessosFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { somentePendentes } }),
    onSuccess: (dados) => qc.setQueryData([...KEY, somentePendentes], dados),
  });
}

/** Busca sob demanda — só dispara com 4+ caracteres digitados. */
export function useBuscarProcesso(termo: string) {
  const fn = useServerFn(buscarProcessoFn);
  return useQuery({
    queryKey: ["busca-processo", termo],
    queryFn: () => fn({ data: { termo } }),
    enabled: termo.trim().length >= 4,
    staleTime: 60_000,
  });
}

export function useVincularProcesso() {
  const fn = useServerFn(vincularProcessoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { casoId: string; codigoProcesso: number; principal?: boolean }) =>
      fn({ data: vars }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyCaso(vars.casoId) });
    },
  });
}

export function useDesvincularProcesso() {
  const fn = useServerFn(desvincularProcessoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { casoId: string; codigoProcesso: number }) => fn({ data: vars }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyCaso(vars.casoId) });
    },
  });
}

export function useDefinirPrincipal() {
  const fn = useServerFn(definirPrincipalFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { casoId: string; codigoProcesso: number }) => fn({ data: vars }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyCaso(vars.casoId) });
    },
  });
}
