import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  finalizeCaseDocumentFn,
  generateCaseDocumentFn,
  listCaseDocumentsFn,
  sendCaseDocumentToZapsignFn,
  softDeleteCaseDocumentFn,
} from "@/rpc/case-documents";

export type ZapsignSigner = {
  name: string;
  email?: string;
  authMode?: string;
  sendAutomaticEmail?: boolean;
};

export function useCaseDocuments(caseId: string) {
  const fn = useServerFn(listCaseDocumentsFn);
  return useQuery({
    queryKey: ["case-documents", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useGenerateCaseDocument(caseId: string) {
  const fn = useServerFn(generateCaseDocumentFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      caseId: string;
      templateId: string;
      title?: string;
      values: Record<string, string>;
    }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-documents", caseId] }),
  });
}

export function useFinalizeCaseDocument(caseId: string) {
  const fn = useServerFn(finalizeCaseDocumentFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-documents", caseId] }),
  });
}

export function useSendCaseDocumentToZapsign(caseId: string) {
  const fn = useServerFn(sendCaseDocumentToZapsignFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { docId: string; signers: ZapsignSigner[] }) =>
      fn({ data: vars as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-documents", caseId] }),
  });
}

export function useDeleteCaseDocument(caseId: string) {
  const fn = useServerFn(softDeleteCaseDocumentFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-documents", caseId] }),
  });
}
