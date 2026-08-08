// Hooks do submenu JUDICIAL (Story G1) — leitura do espelho + sync + andamentos.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getCaseJudicialFn,
  getCaseSigiloStatusFn,
  listCaseJudicialAndamentosFn,
  setCaseProjurisLinkFn,
  syncCaseJudicialFn,
} from "@/rpc/judicial";

export function useCaseJudicial(caseId: string, enabled = true) {
  const fn = useServerFn(getCaseJudicialFn);
  return useQuery({
    queryKey: ["case-judicial", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId && enabled,
  });
}

export function useSyncCaseJudicial(caseId: string) {
  const fn = useServerFn(syncCaseJudicialFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { caseId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-judicial", caseId] }),
  });
}

// M5 — grava/edita/limpa MANUALMENTE o vínculo ProJuris (código + nº CNJ).
// `codigoProcesso` aceita `PRO.0007713` ou o número puro (normalizado no servidor);
// vazio/null limpa o vínculo. Invalida o espelho ao concluir.
export function useSetCaseProjurisLink(caseId: string) {
  const fn = useServerFn(setCaseProjurisLinkFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { codigoProcesso: string | null; numeroProcesso: string | null }) =>
      fn({ data: { caseId, ...vars } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-judicial", caseId] }),
  });
}

export function useCaseJudicialAndamentos(caseId: string, limit = 30, offset = 0, enabled = false) {
  const fn = useServerFn(listCaseJudicialAndamentosFn);
  return useQuery({
    queryKey: ["case-judicial-andamentos", caseId, limit, offset],
    queryFn: () => fn({ data: { caseId, limit, offset } }),
    enabled: !!caseId && enabled,
  });
}

// G4 — status de sigilo do caso (sigiloso + autorizados). Usado pela UI para
// decidir se mostra o submenu Judicial e pela seção de gestão do sigilo.
export function useCaseSigiloStatus(caseId: string, enabled = true) {
  const fn = useServerFn(getCaseSigiloStatusFn);
  return useQuery({
    queryKey: ["case-sigilo", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId && enabled,
  });
}
