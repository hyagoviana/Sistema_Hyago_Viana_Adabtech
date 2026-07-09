import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createDocumentTemplateFn,
  deleteAllDocumentTemplatesFn,
  getTemplatePlaceholdersFn,
  listDocumentTemplatesFn,
  setTypeTemplatesFolderFn,
  softDeleteDocumentTemplateFn,
  syncCaseDocumentFoldersFn,
  syncDocumentTemplatesFn,
  syncProcuracaoTemplatesFn,
  updateDocumentTemplateFn,
} from "@/rpc/document-templates";

// ITEM 1 — marcador de case_type dos modelos de PROCURAÇÃO.
export const PROCURACAO_CASE_TYPE = "PROCURACAO";

export type TemplateFieldInput = {
  key: string;
  label: string;
  source: "auto" | "manual" | "blank";
  required?: boolean;
  auto_field?: string;
};

export function useTemplatePlaceholders(googleDocId: string | null) {
  const fn = useServerFn(getTemplatePlaceholdersFn);
  return useQuery({
    queryKey: ["template-placeholders", googleDocId],
    queryFn: () => fn({ data: { googleDocId: googleDocId! } }),
    enabled: !!googleDocId,
  });
}

// strict=true → lista APENAS o case_type exato (sem o fallback de modelos sem
// tipo). A PROCURAÇÃO usa strict para não misturar os modelos sem case_type.
export function useDocumentTemplates(caseType?: string | null, strict?: boolean) {
  const fn = useServerFn(listDocumentTemplatesFn);
  return useQuery({
    queryKey: ["document-templates", caseType ?? "all", strict ? "strict" : "loose"],
    queryFn: () => fn({ data: { caseType: caseType ?? undefined, strict } }),
  });
}

// ITEM 4 (2026-07-07) — modelos de UMA das 6 pastas do "Documento de caso"
// (filtro por source_folder_id). Só habilita quando há pasta escolhida.
export function useTemplatesByFolder(sourceFolderId: string | null) {
  const fn = useServerFn(listDocumentTemplatesFn);
  return useQuery({
    queryKey: ["document-templates", "folder", sourceFolderId ?? "none"],
    queryFn: () => fn({ data: { sourceFolderId: sourceFolderId! } }),
    enabled: !!sourceFolderId,
  });
}

// (2026-07-09) — modelos vindos de VÁRIAS pastas (as pastas de uma CATEGORIA).
// Usado pelos seletores do caso: procuração e documento de caso passam a listar
// só os modelos das pastas vinculadas ao tipo do caso. Habilita quando há pastas.
export function useTemplatesByFolders(sourceFolderIds: string[] | null | undefined) {
  const fn = useServerFn(listDocumentTemplatesFn);
  const ids = (sourceFolderIds ?? []).filter(Boolean);
  return useQuery({
    queryKey: ["document-templates", "folders", ids.slice().sort().join(",") || "none"],
    queryFn: () => fn({ data: { sourceFolderIds: ids } }),
    enabled: ids.length > 0,
  });
}

// ITEM 4 — sincroniza as 6 pastas do "Documento de caso" (tagueia source_folder_id).
export function useSyncCaseDocumentFolders() {
  const fn = useServerFn(syncCaseDocumentFoldersFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

export function useCreateDocumentTemplate() {
  const fn = useServerFn(createDocumentTemplateFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      google_doc_id: string;
      case_type?: string | null;
      fields?: TemplateFieldInput[];
      goes_to_zapsign?: boolean;
    }) => fn({ data: input as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

export function useUpdateDocumentTemplate() {
  const fn = useServerFn(updateDocumentTemplateFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      fn({ data: vars as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

export function useDeleteDocumentTemplate() {
  const fn = useServerFn(softDeleteDocumentTemplateFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

export function useSyncDocumentTemplates() {
  const syncFn = useServerFn(syncDocumentTemplatesFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderId?: string) => {
      // Incremental: só adiciona novos, dedup por google_doc_id e nome normalizado
      return syncFn({ data: { folderId } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

// ITEM 1 — sincroniza a pasta de PROCURAÇÕES (case_type='PROCURACAO'). Usado pelo
// popup "Gerar documento → Procuração" quando não há modelos sincronizados.
export function useSyncProcuracaoTemplates() {
  const fn = useServerFn(syncProcuracaoTemplatesFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

// Ponto 6 — vincula/troca a pasta de modelos de um TIPO (caso) e já sincroniza.
export function useSetTypeTemplatesFolder() {
  const fn = useServerFn(setTypeTemplatesFolderFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { serviceTypeId: string; folder: string }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-templates"] });
      qc.invalidateQueries({ queryKey: ["service-types"] });
    },
  });
}
