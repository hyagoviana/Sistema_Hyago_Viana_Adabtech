import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { MacroFin, MacroOp } from "@/lib/cases/constants";
import { queryKeys } from "@/lib/queryKeys";
import type { CaseCreateInput, CaseUpdateInput } from "@/lib/validators/case";
import {
  aprovarConferenciaFinFn,
  createCaseFn,
  createComercialProcuracaoFn,
  enviarConferenciaFinFn,
  generateContratoFn,
  generateProcuracaoFn,
  getCaseFn,
  getConferenciaFinPendenteFn,
  liberarCasoFn,
  listCaseEventsFn,
  listCasesFn,
  listCaseResponsaveisFn,
  setCaseResponsaveisFn,
  listComercialCasesFn,
  listComercialDocumentsFn,
  duplicarCasoParaTemaFn,
  marcarCasoPerdidoFn,
  moveCaseStatusFinFn,
  moveCaseStatusFn,
  moverCasoParaTemaFn,
  previewProcuracaoFn,
  promoverCasoManualFn,
  setCaseSigiloFn,
  setCaseUrgencyFn,
  setCaseFieldsLockedFn,
  softDeleteCaseFn,
  updateCaseCanonicalFieldsFn,
  updateCaseFn,
  updateCaseObservacoesFn,
} from "@/rpc/cases";
import { confirmarAssinaturaManualFn } from "@/rpc/case-documents";

type Filters = {
  search?: string;
  macrostatus_op?: MacroOp;
  macrostatus_fin?: MacroFin;
  client_id?: string;
};

export function useCasesList(filters?: Filters) {
  const fn = useServerFn(listCasesFn);
  return useQuery({
    queryKey: queryKeys.cases.list(filters),
    queryFn: () => fn({ data: filters ?? {} }),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

// Responsáveis (advogados) vinculados a um caso — para pré-carregar ao editar.
/**
 * S4-01 — troca o responsável do caso (menu "Editar caso").
 *
 * Um por caso (A2, Thiago 04/09): com um responsável o motor direciona as
 * tarefas para ele; com nenhum, distribui por pontuação.
 */
export function useSetCaseResponsaveis(caseId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(setCaseResponsaveisFn);
  return useMutation({
    mutationFn: (userIds: string[]) => fn({ data: { caseId, userIds } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-responsaveis", caseId ?? "none"] });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

export function useCaseResponsaveis(caseId: string | null | undefined) {
  const fn = useServerFn(listCaseResponsaveisFn);
  return useQuery({
    queryKey: ["case-responsaveis", caseId ?? "none"],
    queryFn: () => fn({ data: { caseId: caseId! } }),
    enabled: !!caseId,
  });
}

export function useCase(id: string) {
  const fn = useServerFn(getCaseFn);
  return useQuery({
    queryKey: queryKeys.cases.detail(id),
    queryFn: () => fn({ data: { id } }),
    enabled: !!id,
  });
}

export function useCaseEvents(caseId: string) {
  const fn = useServerFn(listCaseEventsFn);
  return useQuery({
    queryKey: queryKeys.cases.events(caseId),
    queryFn: () => fn({ data: { id: caseId } }),
    enabled: !!caseId,
  });
}

export function useCreateCase() {
  const fn = useServerFn(createCaseFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseCreateInput) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

// S9-09 — gera (idempotente) a PROCURAÇÃO do caso (doc_kind='procuracao'). O envio
// ao ZapSign carimba aguardando_assinatura_at (ramo de procuração) → caso entra no
// comercial. Aceita valores revisados (override do autofill).
export function useGenerateProcuracao(caseId: string) {
  const fn = useServerFn(generateProcuracaoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      case_id: string;
      client_id: string;
      template_id: string;
      values?: Record<string, string>;
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(caseId) });
    },
  });
}

// S9-09 / S9-12 — gera (idempotente) o CONTRATO do caso (doc_kind='contrato').
// No modelo COMBINADO (Sprint 9.12) o template escolhido é o "Contrato e
// procuração - [serviço]"; aceita `values` revisados no diálogo. Degrada 424 no
// serviço só quando NÃO há template selecionado. Invalida a lista de documentos.
export function useGenerateContrato(caseId: string) {
  const fn = useServerFn(generateContratoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      case_id: string;
      client_id: string;
      template_id?: string | null;
      values?: Record<string, string>;
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(caseId) });
    },
  });
}

// Procuração comercial — preview dos campos <...> + valores do cadastro do
// cliente, para revisão antes de criar o caso. enabled só quando há os 2 ids.
export function usePreviewProcuracao(input: {
  clientId: string;
  templateId: string;
  municipio?: string | null;
  responsavel?: string | null;
}) {
  const fn = useServerFn(previewProcuracaoFn);
  return useQuery({
    queryKey: [
      "procuracao-preview",
      input.clientId,
      input.templateId,
      input.municipio ?? "",
      input.responsavel ?? "",
    ],
    queryFn: () =>
      fn({
        data: {
          client_id: input.clientId,
          template_id: input.templateId,
          municipio: input.municipio ?? undefined,
          responsavel: input.responsavel ?? undefined,
        },
      }),
    enabled: !!input.clientId && !!input.templateId,
    staleTime: 30 * 1000,
  });
}

// Procuração comercial — cria o caso e gera a procuração com os valores
// revisados (finaliza o PDF na pasta do caso). NÃO envia ao ZapSign: o
// documento fica na ficha do caso para baixar e/ou enviar ao ZapSign depois.
export function useCreateComercialProcuracao() {
  const fn = useServerFn(createComercialProcuracaoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      case: CaseCreateInput;
      template_id: string;
      values: Record<string, string>;
      // S7-01 — honorários estruturados da revisão (opcional).
      honorarios?: {
        percentualHonorarios?: number | null;
        valorParcelaCentavos?: number | null;
        descontoAvistaPct?: number | null;
        formaPagamento?: string | null;
        honorariosTotalCentavos?: number | null;
      };
    }) => fn({ data: input as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useUpdateCase() {
  const fn = useServerFn(updateCaseFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: CaseUpdateInput }) => fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(vars.id) });
    },
  });
}

// S2-07 — campos canônicos do CASO (merge no JSONB canonical_fields).
export function useUpdateCaseCanonicalFields() {
  const fn = useServerFn(updateCaseCanonicalFieldsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: Record<string, string | number | boolean | string[] | null>;
    }) => fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(vars.id) });
      // A5 5c — o checkbox de auto-avanço pode ter movido a etapa op: atualiza o
      // Kanban (card pula de coluna) e o checklist da etapa (nova etapa atual).
      qc.invalidateQueries({ queryKey: ["cases-by-service"] });
      qc.invalidateQueries({ queryKey: queryKeys.checklistItems.byCase(vars.id) });
    },
  });
}

// M2 (2026-08-07) — salva o campo Observações (texto livre) do caso. Invalida só
// o detalhe do caso (não mexe em listas/eventos — não é evento de timeline).
export function useUpdateCaseObservacoes(caseId: string) {
  const fn = useServerFn(updateCaseObservacoesFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (observacoes: string) => fn({ data: { id: caseId, observacoes } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
  });
}

// M13 (T3) — urgência do caso (normal/prioritario/urgente) p/ o motor.
export function useSetCaseUrgency(caseId: string) {
  const fn = useServerFn(setCaseUrgencyFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (urgency: "normal" | "prioritario" | "urgente") =>
      fn({ data: { id: caseId, urgency } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
  });
}

// #10 (2026-08-17) — cadeado dos campos do caso (só-leitura na ficha).
export function useSetCaseFieldsLocked(caseId: string) {
  const fn = useServerFn(setCaseFieldsLockedFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (locked: boolean) => fn({ data: { id: caseId, locked } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
  });
}

// Patcha otimisticamente o macrostatus de um caso em todas as listas em cache,
// pra o card "pular" de coluna na hora do drop. Retorna snapshot pra rollback.
function patchCaseInLists(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Record<string, unknown>,
) {
  const snapshot = qc.getQueriesData({ queryKey: queryKeys.cases.lists() });
  qc.setQueriesData<unknown>({ queryKey: queryKeys.cases.lists() }, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    return old.map((c) =>
      c && typeof c === "object" && (c as { id?: string }).id === id ? { ...c, ...patch } : c,
    );
  });
  return snapshot;
}

export function useMoveCaseStatus() {
  const fn = useServerFn(moveCaseStatusFn);
  const qc = useQueryClient();
  return useMutation({
    // `to` = slug da etapa op (configurável por categoria) — texto livre.
    mutationFn: (vars: { id: string; to: string }) => fn({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.cases.lists() });
      const snapshot = patchCaseInLists(qc, vars.id, {
        macrostatus_op: vars.to,
        status_changed_at: new Date().toISOString(),
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useMoveCaseStatusFin() {
  const fn = useServerFn(moveCaseStatusFinFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; to: MacroFin }) => fn({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.cases.lists() });
      const snapshot = patchCaseInLists(qc, vars.id, {
        macrostatus_fin: vars.to,
        status_fin_changed_at: new Date().toISOString(),
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useDeleteCase() {
  const fn = useServerFn(softDeleteCaseFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

// R2 — vincula um caso a um TEMA (reatribui a pipeline p/ o service_type interno
// do tema; a etapa op pode ser resetada se não houver equivalente). Invalida o
// caso (detalhe/listas/eventos) para refletir a nova pipeline/etapa.
export function useMoverCasoParaTema() {
  const fn = useServerFn(moverCasoParaTemaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; temaId: string; frenteSlug?: string | null }) =>
      fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.all });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(vars.id) });
    },
  });
}

// A4 (2026-08-03) — DUPLICAR o caso em outro tema (mantém o original). Invalida a
// lista (nova cópia aparece) e a timeline/detalhe do original (evento cruzado).
export function useDuplicarCasoParaTema() {
  const fn = useServerFn(duplicarCasoParaTemaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; temaId: string; frenteSlug?: string | null }) =>
      fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.all });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(vars.id) });
    },
  });
}

// ----------------------------------------------------------------------------
// S3-03 — Conferência financeira (dupla checagem). Auth-only.
// ----------------------------------------------------------------------------
export function useConferenciaFinPendente(caseId: string) {
  const fn = useServerFn(getConferenciaFinPendenteFn);
  return useQuery({
    queryKey: queryKeys.cases.conferenciaFin(caseId),
    queryFn: () => fn({ data: { id: caseId } }),
    enabled: !!caseId,
  });
}

function invalidateConferencia(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.cases.all });
  qc.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
  qc.invalidateQueries({ queryKey: queryKeys.cases.events(id) });
  qc.invalidateQueries({ queryKey: queryKeys.cases.conferenciaFin(id) });
}

export function useEnviarConferenciaFin() {
  const fn = useServerFn(enviarConferenciaFinFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; to: MacroFin }) => fn({ data: vars }),
    onSuccess: (_, vars) => invalidateConferencia(qc, vars.id),
  });
}

export function useAprovarConferenciaFin() {
  const fn = useServerFn(aprovarConferenciaFinFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: (_, id) => invalidateConferencia(qc, id),
  });
}

// ----------------------------------------------------------------------------
// Comercial (Melhoria 3) — casos aguardando assinatura da procuração
// ----------------------------------------------------------------------------
export function useComercialCases() {
  const fn = useServerFn(listComercialCasesFn);
  return useQuery({
    queryKey: queryKeys.cases.comercial(),
    queryFn: () => fn(),
    staleTime: 60 * 1000,
  });
}

// Aba Assinaturas — DOCUMENTOS enviados ao ZapSign aguardando assinatura.
export function useComercialDocuments() {
  const fn = useServerFn(listComercialDocumentsFn);
  return useQuery({
    queryKey: ["cases", "comercial-documents"],
    queryFn: () => fn(),
    staleTime: 60 * 1000,
  });
}

// Confirmar assinatura a partir da aba Assinaturas (por documento). Reusa o
// mesmo RPC do caso; invalida casos + a lista de documentos aguardando.
export function useConfirmarAssinaturaDoc() {
  const fn = useServerFn(confirmarAssinaturaManualFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case-documents"] });
    },
  });
}

export function useLiberarCaso() {
  const fn = useServerFn(liberarCasoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.all });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
    },
  });
}

// ----------------------------------------------------------------------------
// S1-03 / S1-01b — promover lead→cliente e marcar (lead|cliente)→perdido
// ----------------------------------------------------------------------------
export function usePromoverCasoManual() {
  const fn = useServerFn(promoverCasoManualFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.all });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(id) });
    },
  });
}

export function useMarcarCasoPerdido() {
  const fn = useServerFn(marcarCasoPerdidoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; motivo: string }) => fn({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.all });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cases.events(vars.id) });
    },
  });
}

// G4 — liga/desliga o sigilo do caso + autorizados. Invalida o status de sigilo
// (usePodeVerJudicial reage) e o detalhe do caso.
export function useSetCaseSigilo(caseId: string) {
  const fn = useServerFn(setCaseSigiloFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sigiloso: boolean; userIds: string[] }) =>
      fn({ data: { caseId, sigiloso: vars.sigiloso, userIds: vars.userIds } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-sigilo", caseId] });
      qc.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
    },
  });
}
