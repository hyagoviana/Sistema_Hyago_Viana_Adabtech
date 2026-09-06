// Hooks do cadastro de processo judicial no ProJuris (31/08).
//
// As listas de apoio passam por autenticação + API externa, então ficam em cache
// longo: elas quase não mudam e cada abertura do diálogo pagaria o custo de novo.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  criarProcessoFn,
  getAssuntoGeralProjurisFn,
  listarApoioProcessoFn,
  previewProcessoFn,
  setAssuntoGeralProjurisFn,
  setTemaAssuntoProjurisFn,
  sugestaoProcessoFn,
} from "@/rpc/projuris-processo";

export type { ListasApoioProcesso, OpcaoProcesso } from "@/rpc/projuris-processo";

/** Listas do formulário (área, justiça, situação, classe e assunto CNJ). */
export function useApoioProcesso(habilitado = true) {
  const fn = useServerFn(listarApoioProcessoFn);
  return useQuery({
    queryKey: ["projuris-apoio-processo"],
    queryFn: () => fn(),
    enabled: habilitado,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** O que o caso já preenche sozinho (nome da pasta, assunto, número). */
export function useSugestaoProcesso(caseId: string, habilitado = true) {
  const fn = useServerFn(sugestaoProcessoFn);
  return useQuery({
    queryKey: ["projuris-sugestao-processo", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: habilitado && !!caseId,
    staleTime: 60 * 1000,
  });
}

/** O que a tela manda — espelha o `entradaSchema` do RPC. */
export type EntradaProcesso = {
  caseId: string;
  nomePasta: string;
  assunto: string;
  numeroCnj?: string;
  codigoJustica?: number | null;
  codigoArea?: number | null;
  codigoClasseCnj?: number | null;
  codigoAssuntoCnj?: number | null;
  codigoSituacao?: number | null;
  dataDistribuicao?: string | null;
  valorAcao?: number | null;
  segredoJustica?: boolean;
};

/** Monta o corpo sem enviar — a conferência antes de gravar no ProJuris. */
export function usePreviewProcesso() {
  const fn = useServerFn(previewProcessoFn);
  return useMutation({ mutationFn: (data: EntradaProcesso) => fn({ data }) });
}

/** ESCREVE no ProJuris e vincula o processo ao caso. */
export function useCriarProcessoProjuris(caseId: string) {
  const fn = useServerFn(criarProcessoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EntradaProcesso) => fn({ data }),
    onSuccess: () => {
      // O vínculo mudou: a aba Judicial e a ficha precisam reler.
      qc.invalidateQueries({ queryKey: ["case-judicial", caseId] });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

// ---------------------------------------------------------------------------
// S2-02 — assunto do ProJuris por tema (aba Integrações)
// ---------------------------------------------------------------------------

/** O assunto guarda-chuva ("CÍVEIS"), usado quando o tema não tem o seu. */
export function useAssuntoGeralProjuris() {
  const fn = useServerFn(getAssuntoGeralProjurisFn);
  return useQuery({
    queryKey: ["projuris-assunto-geral"],
    queryFn: () => fn() as Promise<{ id: string | null; nome: string | null }>,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetAssuntoGeralProjuris() {
  const qc = useQueryClient();
  const fn = useServerFn(setAssuntoGeralProjurisFn);
  return useMutation({
    mutationFn: (v: { id?: string | null; nome?: string | null }) => fn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projuris-assunto-geral"] }),
  });
}

export function useSetTemaAssuntoProjuris() {
  const qc = useQueryClient();
  const fn = useServerFn(setTemaAssuntoProjurisFn);
  return useMutation({
    mutationFn: (v: { temaId: string; id?: string | null; nome?: string | null }) =>
      fn({ data: v }),
    // A lista de temas carrega o vínculo — sem invalidar, a tela mostraria o
    // valor antigo depois de salvar.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["temas"] }),
  });
}
