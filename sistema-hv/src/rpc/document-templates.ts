import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createDocumentTemplate,
  listDocumentTemplates,
  softDeleteAllDocumentTemplates,
  softDeleteDocumentTemplate,
  updateDocumentTemplate,
} from "@/lib/document-templates-service";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";
import {
  getTemplatePlaceholders,
  syncTemplatesFromDrive,
  syncTemplatesFromDrives,
} from "@/lib/template-sync-service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Extrai o ID da pasta de uma URL do Drive OU aceita o ID cru.
// Ex.: https://drive.google.com/drive/u/0/folders/ABC123?x=1 → ABC123
function parseDriveFolderId(input: string): string {
  const m = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return input.trim().replace(/[?#].*$/, "");
}

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireAuth();
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  }
}

const fieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  source: z.enum(["auto", "manual", "blank"]),
  required: z.boolean().optional(),
  auto_field: z.string().optional(),
});

export const listDocumentTemplatesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseType: z.string().nullish() }).default({}).parse(d))
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

export const deleteAllDocumentTemplatesFn = createServerFn({ method: "POST" }).handler(async () =>
  handle(() => softDeleteAllDocumentTemplates()),
);

export const getTemplatePlaceholdersFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ googleDocId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => handle(() => getTemplatePlaceholders(data.googleDocId)));

// Aceita uma OU várias pastas, separadas por vírgula. Ex.: pasta "07- Modelos"
// + pasta de procurações — o botão "Sincronizar modelos" varre todas no clique.
const MODELS_FOLDER_IDS = (process.env.GOOGLE_DRIVE_TEMPLATES_FOLDER_ID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const syncDocumentTemplatesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ folderId: z.string().min(1).optional() })
      .default({})
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(() => syncTemplatesFromDrives(data.folderId ? [data.folderId] : MODELS_FOLDER_IDS)),
  );

// Ponto 6 (2026-07-06) — vincula/troca a PASTA de modelos de um TIPO de serviço
// (caso). Salva `templates_folder_id` no tipo e já sincroniza os modelos daquela
// pasta marcando-os com o case_type do tipo. Aceita URL do Drive ou o ID cru.
export const setTypeTemplatesFolderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ serviceTypeId: z.string().uuid(), folder: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const folderId = parseDriveFolderId(data.folder);
      const sb = getSupabaseAdmin();
      const { data: st, error } = await sb
        .from("system_service_types")
        .select("slug")
        .eq("id", data.serviceTypeId)
        .single();
      if (error || !st) throw new Error("Tipo de serviço não encontrado");
      await sb
        .from("system_service_types")
        .update({ templates_folder_id: folderId } as never)
        .eq("id", data.serviceTypeId);
      // Sincroniza os modelos DESSA pasta marcando com o tipo escolhido.
      return syncTemplatesFromDrive(folderId, st.slug);
    }),
  );
