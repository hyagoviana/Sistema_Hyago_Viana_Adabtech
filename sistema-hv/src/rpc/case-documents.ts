import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ensureCaseFolder,
  finalizeCaseDocument,
  generateCaseDocumentFromTemplate,
  getCaseDocumentDownloadUrl,
  listCaseDocuments,
  reopenCaseDocument,
  sendCaseDocumentToZapsign,
  softDeleteCaseDocument,
} from "@/lib/case-documents-service";
import type { ZapSignSignerInput } from "@/lib/zapsign/client";

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  });
}

const caseIdSchema = z.object({ caseId: z.string().uuid() });
const docIdSchema = z.object({ id: z.string().uuid() });

export const listCaseDocumentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => caseIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => listCaseDocuments(data.caseId)));

const generateSchema = z.object({
  caseId: z.string().uuid(),
  templateId: z.string().uuid(),
  title: z.string().optional(),
  values: z.record(z.string(), z.string()).default({}),
});

export const generateCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => generateSchema.parse(d))
  .handler(async ({ data }) =>
    handle(() =>
      generateCaseDocumentFromTemplate({
        caseId: data.caseId,
        templateId: data.templateId,
        title: data.title,
        values: data.values,
      }),
    ),
  );

export const finalizeCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => finalizeCaseDocument(data.id)));

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
    handle(() =>
      sendCaseDocumentToZapsign({
        docId: data.docId,
        signers: data.signers as ZapSignSignerInput[],
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
  .handler(async ({ data }) => handle(() => reopenCaseDocument(data.id)));

export const ensureCaseFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => caseIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => ensureCaseFolder(data.caseId)));

export const softDeleteCaseDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => softDeleteCaseDocument(data.id)));
