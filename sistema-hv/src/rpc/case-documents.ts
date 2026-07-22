import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  confirmarAssinaturaManualDocumento,
  ensureCaseFolder,
  finalizeCaseDocument,
  generateCaseDocumentFromTemplate,
  generateDocumentAsNewCase,
  getCaseDocumentDownloadUrl,
  listCaseDocuments,
  listCaseDocumentsByClient,
  reopenCaseDocument,
  sendCaseDocumentToZapsign,
  softDeleteCaseDocument,
} from "@/lib/case-documents-service";
import { AuthError, requireAnyModule, requireAuth } from "@/lib/supabase/auth-guard";
import type { ZapSignSignerInput } from "@/lib/zapsign/client";

function run<T>(
  guard: () => Promise<{ id: string }>,
  fn: (userId: string) => Promise<T>,
): Promise<T> {
  return (async () => {
    try {
      const { id } = await guard();
      return await fn(id);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      const status = (err as { status?: number })?.status;
      setResponseStatus(typeof status === "number" ? status : 500);
      throw err instanceof Error ? new Error(err.message) : err;
    }
  })();
}

// Leitura: qualquer autenticado.
const handle = <T>(fn: (userId: string) => Promise<T>) => run(() => requireAuth(), fn);
// Escrita de DOCUMENTO do caso (gerar/finalizar/ZapSign/reabrir/excluir/confirmar)
// — acontece na aba do caso (operacional) e no funil comercial (procuração do
// lead). Exige edição em QUALQUER uma; barra colaborador só-view (403).
const handleWrite = <T>(fn: (userId: string) => Promise<T>) =>
  run(() => requireAnyModule(["comercial", "operacional"], "edit"), fn);

const caseIdSchema = z.object({ caseId: z.string().uuid() });
const docIdSchema = z.object({ id: z.string().uuid() });
const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const listCaseDocumentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => caseIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => listCaseDocuments(data.caseId)));

export const listClientCaseDocumentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => clientIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => listCaseDocumentsByClient(data.clientId)));

const generateSchema = z.object({
  caseId: z.string().uuid(),
  templateId: z.string().uuid(),
  title: z.string().optional(),
  values: z.record(z.string(), z.string()).default({}),
  // ITEM 1 — 'procuracao' | 'contrato' (default). Reflete a escolha do popup
  // "Procuração vs Documento do caso".
  docKind: z.enum(["procuracao", "contrato"]).optional(),
});

export const generateCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => generateSchema.parse(d))
  .handler(async ({ data }) =>
    handleWrite((userId) =>
      generateCaseDocumentFromTemplate({
        caseId: data.caseId,
        templateId: data.templateId,
        title: data.title,
        values: data.values,
        docKind: data.docKind,
        triggeredBy: userId,
      }),
    ),
  );

// R2-10 — "Documento de caso" gera um CASO PRÓPRIO (novo caso + doc nele).
const generateAsNewCaseSchema = z.object({
  sourceCaseId: z.string().uuid(),
  templateId: z.string().uuid(),
  title: z.string().optional(),
  values: z.record(z.string(), z.string()).default({}),
  casoPastaNome: z.string().optional().nullable(),
  casoPastaDriveId: z.string().optional().nullable(),
});

export const generateDocumentAsNewCaseFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => generateAsNewCaseSchema.parse(d))
  .handler(async ({ data }) =>
    handleWrite((userId) =>
      generateDocumentAsNewCase({
        sourceCaseId: data.sourceCaseId,
        templateId: data.templateId,
        title: data.title,
        values: data.values,
        casoPastaNome: data.casoPastaNome,
        casoPastaDriveId: data.casoPastaDriveId,
        triggeredBy: userId,
      }),
    ),
  );

export const finalizeCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docIdSchema.parse(d))
  .handler(async ({ data }) => handleWrite((userId) => finalizeCaseDocument(data.id, userId)));

const signerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phoneCountry: z.string().optional(),
  phoneNumber: z.string().optional(),
  authMode: z
    .enum([
      "assinaturaTela",
      "tokenEmail",
      "assinaturaTela-tokenEmail",
      "tokenSms",
      "tokenWhatsapp",
      "certificadoDigital",
    ])
    .optional(),
  sendAutomaticEmail: z.boolean().optional(),
  cpf: z.string().optional(),
});

const sendSchema = z.object({
  docId: z.string().uuid(),
  signers: z.array(signerSchema).min(1),
});

export const sendCaseDocumentToZapsignFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data }) =>
    handleWrite((userId) =>
      sendCaseDocumentToZapsign({
        docId: data.docId,
        signers: data.signers as ZapSignSignerInput[],
        triggeredBy: userId,
      }),
    ),
  );

export const downloadCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), format: z.enum(["pdf", "docx"]) }).parse(d),
  )
  .handler(async ({ data }) => handle(() => getCaseDocumentDownloadUrl(data.id, data.format)));

export const reopenCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docIdSchema.parse(d))
  .handler(async ({ data }) => handleWrite((userId) => reopenCaseDocument(data.id, userId)));

export const ensureCaseFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => caseIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => ensureCaseFolder(data.caseId)));

export const softDeleteCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docIdSchema.parse(d))
  .handler(async ({ data }) => handleWrite((userId) => softDeleteCaseDocument(data.id, userId)));

// ITEM 5 — confirma a assinatura MANUALMENTE (equivalente ao webhook ZapSign,
// que está adiado). Promove o caso conforme o doc_kind (contrato → CLIENTE;
// procuração → GANHO comercial).
export const confirmarAssinaturaManualFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docIdSchema.parse(d))
  .handler(async ({ data }) =>
    handleWrite((userId) => confirmarAssinaturaManualDocumento(data.id, userId)),
  );
