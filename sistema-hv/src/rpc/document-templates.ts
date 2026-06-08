import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createDocumentTemplate,
  listDocumentTemplates,
  softDeleteDocumentTemplate,
  updateDocumentTemplate,
} from "@/lib/document-templates-service";

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  });
}

const fieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  source: z.enum(["auto", "manual", "blank"]),
  required: z.boolean().optional(),
  auto_field: z.string().optional(),
});

export const listDocumentTemplatesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ caseType: z.string().nullish() }).default({}).parse(d),
  )
  .handler(async ({ data }) => handle(() => listDocumentTemplates({ caseType: data.caseType })));

const createSchema = z.object({
  name: z.string().min(1),
  google_doc_id: z.string().min(1),
  case_type: z.string().nullish(),
  fields: z.array(fieldSchema).default([]),
  goes_to_zapsign: z.boolean().default(false),
});

export const createDocumentTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) =>
    handle(() =>
      createDocumentTemplate({
        name: data.name,
        google_doc_id: data.google_doc_id,
        case_type: data.case_type,
        fields: data.fields,
        goes_to_zapsign: data.goes_to_zapsign,
      }),
    ),
  );

const updateSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().optional(),
    google_doc_id: z.string().optional(),
    case_type: z.string().nullish(),
    fields: z.array(fieldSchema).optional(),
    goes_to_zapsign: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateDocumentTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data }) => handle(() => updateDocumentTemplate(data.id, data.patch)));

export const softDeleteDocumentTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => softDeleteDocumentTemplate(data.id)));
