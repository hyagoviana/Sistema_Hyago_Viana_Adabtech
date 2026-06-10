import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createDocumentTemplateFn,
  deleteAllDocumentTemplatesFn,
  getTemplatePlaceholdersFn,
  listDocumentTemplatesFn,
  softDeleteDocumentTemplateFn,
  syncDocumentTemplatesFn,
  updateDocumentTemplateFn,
} from "@/rpc/document-templates";

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

export function useDocumentTemplates(caseType?: string | null) {
  const fn = useServerFn(listDocumentTemplatesFn);
  return useQuery({
    queryKey: ["document-templates", caseType ?? "all"],
    queryFn: () => fn({ data: { caseType: caseType ?? undefined } }),
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
  const deleteFn = useServerFn(deleteAllDocumentTemplatesFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderId?: string) => {
      // Limpa tudo antes de re-sincronizar (evita duplicatas)
      await deleteFn({});
      return syncFn({ data: { folderId } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}
