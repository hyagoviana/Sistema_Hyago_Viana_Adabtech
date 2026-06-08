// Server-only — CRUD de modelos de documento (system_document_templates).
// Usado pelo cadastro admin e pela geração de documentos do caso.

import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class DocumentTemplateServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DocumentTemplateServiceError";
  }
}

export type TemplateField = {
  key: string;
  label: string;
  source: "auto" | "manual" | "blank";
  required?: boolean;
  auto_field?: string;
};

export async function listDocumentTemplates(opts?: { caseType?: string | null }) {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_document_templates_active")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  if (opts?.caseType) q = q.eq("case_type", opts.caseType);
  const { data, error } = await q;
  if (error) throw new DocumentTemplateServiceError(error.message, 500);
  return data ?? [];
}

export async function getDocumentTemplate(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_document_templates")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new DocumentTemplateServiceError("Modelo não encontrado", 404);
  return data;
}

export async function createDocumentTemplate(input: {
  name: string;
  google_doc_id: string;
  case_type?: string | null;
  fields?: TemplateField[];
  goes_to_zapsign?: boolean;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_document_templates")
    .insert({
      organization_id: DEFAULT_ORG,
      name: input.name,
      google_doc_id: input.google_doc_id,
      case_type: input.case_type ?? null,
      fields: (input.fields ?? []) as never,
      goes_to_zapsign: input.goes_to_zapsign ?? false,
    })
    .select()
    .single();
  if (error || !data) throw new DocumentTemplateServiceError(error?.message ?? "Falha ao criar modelo", 500);
  return data;
}

export async function updateDocumentTemplate(
  id: string,
  patch: Partial<{
    name: string;
    google_doc_id: string;
    case_type: string | null;
    fields: TemplateField[];
    goes_to_zapsign: boolean;
    active: boolean;
  }>,
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_document_templates")
    .update({ ...patch, fields: patch.fields as never })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new DocumentTemplateServiceError(error?.message ?? "Falha ao atualizar", 500);
  return data;
}

export async function softDeleteDocumentTemplate(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_document_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new DocumentTemplateServiceError(error.message, 500);
  return { ok: true as const, id };
}
