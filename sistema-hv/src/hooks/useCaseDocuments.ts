import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  confirmarAssinaturaManualFn,
  downloadCaseDocumentFn,
  finalizeCaseDocumentFn,
  generateCaseDocumentFn,
  listCaseDocumentsFn,
  listClientCaseDocumentsFn,
  reopenCaseDocumentFn,
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

// Documentos gerados em TODOS os casos de um cliente (exibidos na ficha do cliente).
export function useClientCaseDocuments(clientId: string) {
  const fn = useServerFn(listClientCaseDocumentsFn);
  return useQuery({
    queryKey: ["client-case-documents", clientId],
    queryFn: () => fn({ data: { clientId } }),
    enabled: !!clientId,
  });
}

// Anexa um documento (PDF/DOC/DOCX) direto na pasta do CASO no Drive via upload
// multipart (rota api.cases.$id.documents.upload). Segue o padrão de upload de
// documentos do CLIENTE (magic-bytes anti-spoofing no servidor).
export function useUploadCaseDocument(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/cases/${caseId}/documents/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const data = (await res.json()) as { error?: string };
          msg = data.error ?? msg;
        } catch {
          /* mantém statusText */
        }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
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
      docKind?: "procuracao" | "contrato";
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useFinalizeCaseDocument(caseId: string) {
  const fn = useServerFn(finalizeCaseDocumentFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useSendCaseDocumentToZapsign(caseId: string) {
  const fn = useServerFn(sendCaseDocumentToZapsignFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { docId: string; signers: ZapsignSigner[] }) => fn({ data: vars as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useDownloadCaseDocument() {
  const fn = useServerFn(downloadCaseDocumentFn);
  return useMutation({
    mutationFn: async (vars: { id: string; format: "pdf" | "docx" }) => {
      const res = await fn({ data: vars });
      // Abre a URL de exportação numa nova aba (download direto).
      if (res?.url && typeof window !== "undefined") window.open(res.url, "_blank", "noopener");
      return res;
    },
  });
}

export function useReopenCaseDocument(caseId: string) {
  const fn = useServerFn(reopenCaseDocumentFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useDeleteCaseDocument(caseId: string) {
  const fn = useServerFn(softDeleteCaseDocumentFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

// ITEM 5 — confirma a assinatura manualmente (caminho manual do webhook ZapSign).
// Promove o caso (contrato → CLIENTE; procuração → GANHO). Invalida documentos,
// eventos e a lista/detalhe de casos (o lifecycle muda).
export function useConfirmarAssinaturaManual(caseId: string) {
  const fn = useServerFn(confirmarAssinaturaManualFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-documents", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}
