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

// Os TERMOS DE ACERTO ficam na MESMA pasta das procurações e, no sync, recebem
// case_type='PROCURACAO'. Eles NÃO devem aparecer no picker de procuração/documento
// (são usados só no fluxo financeiro, via TermoPanel, que localiza o modelo pelo
// NOME — ignorando case_type). Detecção por nome: "TERMO" + "ACERTO".
function isTermoTemplateName(name: string): boolean {
  const norm = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  return norm.includes("TERMO") && norm.includes("ACERTO");
}

export async function listDocumentTemplates(opts?: {
  caseType?: string | null;
  // strict=true → filtra APENAS case_type = {caseType} (SEM o fallback de null).
  // Usado pela PROCURAÇÃO, que deve listar só os modelos da pasta de procuração
  // (case_type='PROCURACAO'), sem misturar os modelos sem tipo (case_type null).
  strict?: boolean;
  // ITEM 4 (2026-07-07) — filtra por pasta de origem (Drive folder id). Usado
  // pelo caminho "Documento de caso": passo 1 escolhe 1 das 6 pastas, passo 2
  // lista só os docs daquela pasta. Quando presente, IGNORA o filtro de case_type
  // (a fonte da verdade é a pasta).
  sourceFolderId?: string | null;
  // (2026-07-09) — filtra por VÁRIAS pastas de origem. Usado pelo vínculo de
  // pastas por CATEGORIA (uma categoria pode ter N pastas de caso/procuração).
  // Precede case_type; ignora-o (a fonte da verdade são as pastas da categoria).
  sourceFolderIds?: string[] | null;
}) {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_document_templates_active")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  const folderIds = (opts?.sourceFolderIds ?? []).filter(Boolean);
  if (folderIds.length > 0) {
    // Filtra pelos modelos vindos de QUALQUER uma das pastas da categoria.
    q = q.in("source_folder_id" as never, folderIds as never);
  } else if (opts?.sourceFolderId) {
    // `source_folder_id` (ITEM 4) ainda não está no types.ts gerado — cast.
    q = q.eq("source_folder_id" as never, opts.sourceFolderId as never);
  } else if (opts?.caseType) {
    const ct = opts.caseType.replace(/[,()]/g, "");
    if (ct) {
      if (opts.strict) {
        // ESTRITO: só o case_type exato (sem os modelos sem tipo).
        q = q.eq("case_type", ct);
      } else {
        // Modelos sem tipo (case_type NULL) valem para qualquer caso.
        q = q.or(`case_type.eq.${ct},case_type.is.null`);
      }
    }
  }
  const { data, error } = await q;
  if (error) throw new DocumentTemplateServiceError(error.message, 500);
  // Remove os termos de acerto quando a lista é de procuração (não podem aparecer
  // no picker; o TermoPanel os acha pelo nome, então isso não afeta o financeiro).
  const rows =
    opts?.caseType === "PROCURACAO"
      ? (data ?? []).filter((t) => !isTermoTemplateName(t.name))
      : (data ?? []);
  // Dedup por nome normalizado — prefere o que TEM campos (Google Doc nativo)
  const seen = new Map<string, (typeof rows)[number]>();
  for (const tpl of rows) {
    const key = tpl.name
      .replace(/^c[oó]pia\s+de\s+/i, "")
      .replace(/\s*-\s*modelo$/i, "")
      .replace(/\s*\(modelo\)\s*/i, "")
      .trim()
      .toLowerCase();
    const existing = seen.get(key);
    // Mantém o que tem mais campos (Google Doc nativo extrai melhor que .docx)
    const existingFields = Array.isArray(existing?.fields) ? existing.fields.length : 0;
    const newFields = Array.isArray(tpl.fields) ? tpl.fields.length : 0;
    if (!existing || newFields > existingFields) {
      seen.set(key, tpl);
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
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
  if (error || !data)
    throw new DocumentTemplateServiceError(error?.message ?? "Falha ao criar modelo", 500);
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
  if (error || !data)
    throw new DocumentTemplateServiceError(error?.message ?? "Falha ao atualizar", 500);
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

export async function softDeleteAllDocumentTemplates() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_document_templates")
    .update({ deleted_at: new Date().toISOString() })
    .is("deleted_at", null)
    .select("id");
  if (error) throw new DocumentTemplateServiceError(error.message, 500);
  return { ok: true as const, count: data?.length ?? 0 };
}
