// Hooks do FINANCEIRO DO CASO (FN1). A chave de cache é por caso — mexer num
// lançamento invalida a lista e o resumo do MESMO caso, não do sistema inteiro.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  fazerLancamentoContaAzulFn,
  listarCatalogoContaAzulFn,
  sincronizarCategoriasContaAzulFn,
  atualizarFinParcelaFn,
  criarFinEntryFn,
  excluirFinEntryFn,
  listCaseFinEntriesFn,
  listFinCategoriasFn,
  resumoFinanceiroCasoFn,
  setFinEntryStatusFn,
  setTemaContaAzulFn,
} from "@/rpc/financeiro-caso";

const KEY_ENTRIES = (caseId: string) => ["fin-entries", caseId];
const KEY_RESUMO = (caseId: string) => ["fin-resumo", caseId];

export function useFinCategorias(kind?: "RECEITA" | "DESPESA" | null) {
  const fn = useServerFn(listFinCategoriasFn);
  return useQuery({
    queryKey: ["fin-categorias", kind ?? "todas"],
    queryFn: () => fn({ data: { kind: kind ?? null } }),
    staleTime: 10 * 60 * 1000, // a árvore muda muito raramente
  });
}

export function useCaseFinEntries(caseId: string) {
  const fn = useServerFn(listCaseFinEntriesFn);
  return useQuery({
    queryKey: KEY_ENTRIES(caseId),
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useResumoFinanceiroCaso(caseId: string) {
  const fn = useServerFn(resumoFinanceiroCasoFn);
  return useQuery({
    queryKey: KEY_RESUMO(caseId),
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

function useInvalidar(caseId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY_ENTRIES(caseId) });
    qc.invalidateQueries({ queryKey: KEY_RESUMO(caseId) });
  };
}

export function useCriarFinEntry(caseId: string) {
  const fn = useServerFn(criarFinEntryFn);
  const invalidar = useInvalidar(caseId);
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => fn({ data: input as never }),
    onSuccess: invalidar,
  });
}

export function useSetFinEntryStatus(caseId: string) {
  const fn = useServerFn(setFinEntryStatusFn);
  const invalidar = useInvalidar(caseId);
  return useMutation({
    mutationFn: (vars: { entryId: string; status: "AGUARDANDO" | "DISPENSADO" | "LANCADO" }) =>
      fn({ data: vars }),
    onSuccess: invalidar,
  });
}

export function useExcluirFinEntry(caseId: string) {
  const fn = useServerFn(excluirFinEntryFn);
  const invalidar = useInvalidar(caseId);
  return useMutation({
    mutationFn: (entryId: string) => fn({ data: { entryId } }),
    onSuccess: invalidar,
  });
}

export function useAtualizarFinParcela(caseId: string) {
  const fn = useServerFn(atualizarFinParcelaFn);
  const invalidar = useInvalidar(caseId);
  return useMutation({
    mutationFn: (vars: {
      parcelaId: string;
      data_vencimento?: string;
      valor_centavos?: number;
      status?: "AGUARDANDO" | "VENCIDA" | "PAGA" | "CANCELADA";
    }) => fn({ data: vars }),
    onSuccess: invalidar,
  });
}

export function useSetTemaContaAzul() {
  const fn = useServerFn(setTemaContaAzulFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      temaId: string;
      centroCustoId?: string | null;
      centroCustoNome?: string | null;
      servicoId?: string | null;
      servicoNome?: string | null;
    }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["temas"] }),
  });
}

// ─── ContaAzul (FN2, 2026-08-28) ─────────────────────────────────────────────

/** Contas de recebimento e centros de custo, para os seletores do lançamento. */
export function useCatalogoContaAzul(habilitado = true) {
  const fn = useServerFn(listarCatalogoContaAzulFn);
  return useQuery({
    queryKey: ["contaazul-catalogo"],
    queryFn: () => fn(),
    enabled: habilitado,
    // Muda raramente e a chamada vai à API externa: não vale rebuscar a cada foco.
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/**
 * Envia o lançamento ao ContaAzul.
 *
 * Sem `onSuccess` automático de toast: quem chama decide a mensagem, porque
 * "não foi" nem sempre é erro (ex.: categoria ainda não cadastrada lá é uma
 * pendência do escritório, não uma falha do sistema).
 */
export function useFazerLancamentoContaAzul(caseId: string) {
  const fn = useServerFn(fazerLancamentoContaAzulFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => fn({ data: { entryId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_ENTRIES(caseId) });
      qc.invalidateQueries({ queryKey: KEY_RESUMO(caseId) });
    },
  });
}

/** Amarra as categorias do SHV às do ContaAzul pelo código. */
export function useSincronizarCategoriasContaAzul() {
  const fn = useServerFn(sincronizarCategoriasContaAzulFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-categorias"] }),
  });
}
