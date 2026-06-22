// Server-only — orquestra documentos do CASO: gerar (Google Docs) → editar
// (embutido) → finalizar (PDF na pasta do caso) → enviar ao ZapSign.
// Identidades: Google Docs/edição = conta-sistema OAuth (docs.ts);
// storage da pasta do caso = Service Account (drive.ts). NUNCA no browser.

import { createHash } from "node:crypto";

import { createFolder, deleteFile as trashDriveFile, uploadFile, DriveError } from "./google/drive";
import {
  copyTemplate,
  docUrl,
  exportPdf,
  lockDocument,
  replacePlaceholders,
  setLinkEditable,
  DocsError,
} from "./google/docs";
import { getSupabaseAdmin } from "./supabase/server";
import { createDocument, type ZapSignSignerInput } from "./zapsign/client";

export class CaseDocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CaseDocumentServiceError";
  }
}

// Falhas de dependência externa (Google Docs/Drive/ZapSign) usam 424 (Failed
// Dependency), NÃO 502/503/504: o gateway da Vercel intercepta 5xx de gateway
// e devolve "Bad Gateway" genérico, escondendo a mensagem real do usuário.
// Com 424 (4xx) a resposta passa intacta e o front mostra o erro de verdade.
const EXTERNAL_DEP_FAILED = 424;

function sha256Hex(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

// ----------------------------------------------------------------------------
// LIST / GET
// ----------------------------------------------------------------------------
export async function listCaseDocuments(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_documents_active")
    .select("*")
    .eq("case_id", caseId)
    .order("document_number", { ascending: true });
  if (error) throw new CaseDocumentServiceError(error.message, 500);
  return data ?? [];
}

export async function getCaseDocument(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_documents")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new CaseDocumentServiceError("Documento não encontrado", 404);
  return data;
}

// Lista todos os documentos gerados nos CASOS de um cliente (procurações etc.),
// para exibir na ficha do cliente. Read-only — a gestão continua no caso.
export async function listCaseDocumentsByClient(clientId: string) {
  const sb = getSupabaseAdmin();
  const { data: cases, error: cErr } = await sb
    .from("system_cases")
    .select("id, case_code")
    .eq("client_id", clientId)
    .is("deleted_at", null);
  if (cErr) throw new CaseDocumentServiceError(cErr.message, 500);

  const caseIds = (cases ?? []).map((c) => c.id);
  if (caseIds.length === 0) return [];

  const codeById = new Map((cases ?? []).map((c) => [c.id, c.case_code]));
  const { data, error } = await sb
    .from("system_case_documents_active")
    .select("*")
    .in("case_id", caseIds)
    .order("created_at", { ascending: false });
  if (error) throw new CaseDocumentServiceError(error.message, 500);

  return (data ?? []).map((d) => ({ ...d, case_code: codeById.get(d.case_id) ?? null }));
}

// ----------------------------------------------------------------------------
// S12-2 — Pasta do caso no Drive (idempotente). Criada sob a pasta do cliente.
// ----------------------------------------------------------------------------
export async function ensureCaseFolder(caseId: string): Promise<{
  folderId: string;
  folderUrl: string | null;
}> {
  const sb = getSupabaseAdmin();
  const { data: caso, error } = await sb
    .from("system_cases")
    .select("id, organization_id, client_id, case_code, drive_folder_id, drive_folder_url")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (error || !caso) throw new CaseDocumentServiceError("Caso não encontrado", 404);

  if (caso.drive_folder_id) {
    return { folderId: caso.drive_folder_id, folderUrl: caso.drive_folder_url };
  }

  const { data: client, error: cErr } = await sb
    .from("system_clients")
    .select("id, drive_folder_id")
    .eq("id", caso.client_id)
    .single();
  if (cErr || !client?.drive_folder_id) {
    throw new CaseDocumentServiceError(
      "Cliente sem pasta no Drive — crie a pasta do cliente antes de gerar documentos do caso",
      409,
    );
  }

  try {
    const folder = await createFolder(`Caso-${caso.case_code}`, client.drive_folder_id);
    await sb
      .from("system_cases")
      .update({
        drive_folder_id: folder.id,
        drive_folder_url: folder.url,
        drive_sync_failed: false,
        drive_sync_error: null,
      })
      .eq("id", caso.id);
    return { folderId: folder.id, folderUrl: folder.url };
  } catch (err) {
    const msg =
      err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
    await sb
      .from("system_cases")
      .update({ drive_sync_failed: true, drive_sync_error: msg.slice(0, 2000) })
      .eq("id", caso.id);
    throw new CaseDocumentServiceError(
      `Falha ao criar pasta do caso no Drive: ${msg}`,
      EXTERNAL_DEP_FAILED,
    );
  }
}

// ----------------------------------------------------------------------------
// GENERATE — copia o modelo (Google Doc) → substitui placeholders → link-editável
// ----------------------------------------------------------------------------
export async function generateCaseDocumentFromTemplate(opts: {
  caseId: string;
  templateId: string;
  title?: string;
  values: Record<string, string>;
  docKind?: string;
  triggeredBy?: string;
}) {
  const sb = getSupabaseAdmin();

  const { data: caso, error: caseErr } = await sb
    .from("system_cases")
    .select("id, organization_id")
    .eq("id", opts.caseId)
    .is("deleted_at", null)
    .single();
  if (caseErr || !caso) throw new CaseDocumentServiceError("Caso não encontrado", 404);

  const { data: tpl, error: tplErr } = await sb
    .from("system_document_templates")
    .select("id, name, google_doc_id, goes_to_zapsign, fields")
    .eq("id", opts.templateId)
    .is("deleted_at", null)
    .single();
  if (tplErr || !tpl) throw new CaseDocumentServiceError("Modelo não encontrado", 404);

  // Valida campos obrigatórios não preenchidos (G-08).
  const fields = (tpl.fields as Array<{ key: string; required?: boolean; source?: string }>) ?? [];
  const faltando = fields
    .filter((f) => f.required && f.source !== "blank" && !String(opts.values?.[f.key] ?? "").trim())
    .map((f) => f.key);
  if (faltando.length > 0) {
    throw new CaseDocumentServiceError(
      `Campos obrigatórios não preenchidos: ${faltando.join(", ")}`,
      422,
    );
  }

  const title = opts.title?.trim() || tpl.name;

  // Garante pasta do caso ANTES de copiar — senão o Google Drive cria a cópia
  // dentro da pasta do modelo original (07-Modelos), não na pasta do caso.
  const { folderId: caseFolderId } = await ensureCaseFolder(opts.caseId);

  let docId: string;
  try {
    const copy = await copyTemplate(tpl.google_doc_id, title, caseFolderId);
    docId = copy.id;
    await replacePlaceholders(docId, opts.values ?? {});
    await setLinkEditable(docId);
  } catch (err) {
    const msg = err instanceof DocsError ? err.message : String(err);
    throw new CaseDocumentServiceError(
      `Falha ao gerar via Google Docs: ${msg}`,
      EXTERNAL_DEP_FAILED,
    );
  }

  const { data: doc, error: insErr } = await sb
    .from("system_case_documents")
    .insert({
      case_id: caso.id,
      organization_id: caso.organization_id,
      title,
      status: "EM_EDICAO",
      source: "GERADO",
      template_id: tpl.id,
      google_doc_id: docId,
      goes_to_zapsign: tpl.goes_to_zapsign,
      ...(opts.docKind ? { doc_kind: opts.docKind } : {}),
    })
    .select()
    .single();
  if (insErr || !doc) {
    throw new CaseDocumentServiceError(
      `Falha ao gravar documento (${insErr?.message ?? "?"})`,
      500,
    );
  }

  await sb.from("system_audit_log").insert({
    organization_id: caso.organization_id,
    action: "case_document.generate",
    entity_type: "case_document",
    entity_id: doc.id,
    diff: { template_id: tpl.id, google_doc_id: docId },
  });

  // Registra evento na timeline do caso
  await sb.from("system_case_events").insert({
    case_id: caso.id,
    organization_id: caso.organization_id,
    action: "doc_generated",
    diff: { doc_title: title, template_name: tpl.name, doc_id: doc.id },
    triggered_by: opts.triggeredBy ?? null,
  });

  return { doc, editUrl: docUrl(docId) };
}

// ----------------------------------------------------------------------------
// FINALIZE — exporta PDF → trava o doc → sobe na pasta do caso
// ----------------------------------------------------------------------------
export async function finalizeCaseDocument(docId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const doc = await getCaseDocument(docId);
  if (!doc.google_doc_id) {
    throw new CaseDocumentServiceError("Documento sem Google Doc para finalizar", 409);
  }

  const { folderId } = await ensureCaseFolder(doc.case_id);

  let pdf: Buffer;
  try {
    pdf = await exportPdf(doc.google_doc_id);
    await lockDocument(doc.google_doc_id);
  } catch (err) {
    const msg = err instanceof DocsError ? err.message : String(err);
    throw new CaseDocumentServiceError(`Falha ao exportar/travar PDF: ${msg}`, EXTERNAL_DEP_FAILED);
  }

  const fileName = `${String(doc.document_number ?? 0).padStart(2, "0")}-${doc.title}.pdf`;
  let drive;
  try {
    drive = await uploadFile({
      parentId: folderId,
      name: fileName,
      mimeType: "application/pdf",
      body: pdf,
    });
  } catch (err) {
    const msg = err instanceof DriveError ? err.message : String(err);
    throw new CaseDocumentServiceError(
      `Falha ao subir PDF na pasta do caso: ${msg}`,
      EXTERNAL_DEP_FAILED,
    );
  }

  const { data: updated, error: upErr } = await sb
    .from("system_case_documents")
    .update({
      status: "FINALIZADO",
      drive_file_id: drive.id,
      drive_url: drive.url,
      mime_type: "application/pdf",
      size_bytes: pdf.byteLength,
      sha256: sha256Hex(pdf),
    })
    .eq("id", doc.id)
    .select()
    .single();
  if (upErr || !updated) throw new CaseDocumentServiceError("Falha ao atualizar documento", 500);

  await sb.from("system_audit_log").insert({
    organization_id: doc.organization_id,
    action: "case_document.finalize",
    entity_type: "case_document",
    entity_id: doc.id,
    diff: { drive_file_id: drive.id, sha256: updated.sha256 },
  });

  // Registra evento na timeline do caso
  await sb.from("system_case_events").insert({
    case_id: doc.case_id,
    organization_id: doc.organization_id,
    action: "doc_finalized",
    diff: { doc_title: doc.title, doc_id: doc.id },
    triggered_by: triggeredBy ?? null,
  });

  return updated;
}

// ----------------------------------------------------------------------------
// DOWNLOAD — devolve a URL de exportação (PDF/DOCX). Os docs são link-editáveis,
// então a exportação direta do Google Docs é pública; fallback no PDF do Drive.
// ----------------------------------------------------------------------------
export async function getCaseDocumentDownloadUrl(docId: string, format: "pdf" | "docx") {
  const doc = await getCaseDocument(docId);
  if (doc.google_doc_id) {
    const fmt = format === "docx" ? "docx" : "pdf";
    return {
      url: `https://docs.google.com/document/d/${doc.google_doc_id}/export?format=${fmt}`,
    };
  }
  // Sem Google Doc: só o PDF finalizado no Drive serve.
  if (format === "pdf" && doc.drive_url) return { url: doc.drive_url };
  throw new CaseDocumentServiceError("Documento sem arquivo para baixar neste formato", 409);
}

// ----------------------------------------------------------------------------
// REOPEN — reabre um documento FINALIZADO para edição (reverte o lock do finalize)
// ----------------------------------------------------------------------------
export async function reopenCaseDocument(docId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const doc = await getCaseDocument(docId);
  if (doc.status !== "FINALIZADO") {
    throw new CaseDocumentServiceError("Só um documento finalizado pode ser reaberto", 409);
  }
  if (doc.google_doc_id) {
    try {
      await setLinkEditable(doc.google_doc_id);
    } catch (err) {
      const msg = err instanceof DocsError ? err.message : String(err);
      throw new CaseDocumentServiceError(
        `Falha ao reabrir edição no Google Docs: ${msg}`,
        EXTERNAL_DEP_FAILED,
      );
    }
  }
  const { data, error } = await sb
    .from("system_case_documents")
    .update({ status: "EM_EDICAO" })
    .eq("id", doc.id)
    .select()
    .single();
  if (error || !data) throw new CaseDocumentServiceError("Falha ao reabrir documento", 500);

  await sb.from("system_audit_log").insert({
    organization_id: doc.organization_id,
    action: "case_document.reopen",
    entity_type: "case_document",
    entity_id: doc.id,
  });

  // Registra evento na timeline do caso
  await sb.from("system_case_events").insert({
    case_id: doc.case_id,
    organization_id: doc.organization_id,
    action: "doc_reopened",
    diff: { doc_title: doc.title, doc_id: doc.id },
    triggered_by: triggeredBy ?? null,
  });

  return data;
}

// ----------------------------------------------------------------------------
// SEND TO ZAPSIGN — envia o PDF finalizado para assinatura
// ----------------------------------------------------------------------------
export async function sendCaseDocumentToZapsign(opts: {
  docId: string;
  signers: ZapSignSignerInput[];
  triggeredBy?: string;
}) {
  const sb = getSupabaseAdmin();
  const doc = await getCaseDocument(opts.docId);
  if (doc.status !== "FINALIZADO") {
    throw new CaseDocumentServiceError("Finalize o documento antes de enviar ao ZapSign", 409);
  }
  if (!doc.google_doc_id && !doc.drive_file_id) {
    throw new CaseDocumentServiceError("Documento sem arquivo para enviar ao ZapSign", 409);
  }
  if (!opts.signers?.length) {
    throw new CaseDocumentServiceError("Informe ao menos um signatário", 422);
  }

  let base64Pdf: string;
  try {
    if (doc.google_doc_id) {
      base64Pdf = (await exportPdf(doc.google_doc_id)).toString("base64");
    } else {
      // Documento finalizado via Drive (sem Google Doc nativo) — baixar PDF existente
      const { downloadFile } = await import("./google/drive");
      const stream = await downloadFile(doc.drive_file_id!);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      base64Pdf = Buffer.concat(chunks).toString("base64");
    }
  } catch (err) {
    const msg = err instanceof DocsError ? err.message : String(err);
    throw new CaseDocumentServiceError(`Falha ao preparar PDF: ${msg}`, EXTERNAL_DEP_FAILED);
  }

  const zdoc = await createDocument({
    name: doc.title,
    base64Pdf,
    externalId: doc.id,
    signers: opts.signers,
  });

  const { data: updated, error } = await sb
    .from("system_case_documents")
    .update({
      status: "ENVIADO_ZAPSIGN",
      goes_to_zapsign: true,
      zapsign_doc_token: zdoc.token,
      zapsign_sign_url: zdoc.signers?.[0]?.sign_url ?? null,
    })
    .eq("id", doc.id)
    .select()
    .single();
  if (error || !updated) throw new CaseDocumentServiceError("Falha ao atualizar documento", 500);

  await sb.from("system_audit_log").insert({
    organization_id: doc.organization_id,
    action: "case_document.send_zapsign",
    entity_type: "case_document",
    entity_id: doc.id,
    diff: { zapsign_doc_token: zdoc.token },
  });

  // Registra evento na timeline do caso
  await sb.from("system_case_events").insert({
    case_id: doc.case_id,
    organization_id: doc.organization_id,
    action: "doc_sent_zapsign",
    diff: { doc_title: doc.title, doc_id: doc.id },
    triggered_by: opts.triggeredBy ?? null,
  });

  return { doc: updated, signUrl: updated.zapsign_sign_url };
}

// ----------------------------------------------------------------------------
// SOFT DELETE
// ----------------------------------------------------------------------------
export async function softDeleteCaseDocument(docId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const doc = await getCaseDocument(docId);

  await sb
    .from("system_case_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", doc.id);

  if (doc.drive_file_id) {
    try {
      await trashDriveFile(doc.drive_file_id);
    } catch (err) {
      console.error("case-documents-service: trash Drive falhou:", err);
    }
  }

  await sb.from("system_audit_log").insert({
    organization_id: doc.organization_id,
    action: "case_document.delete",
    entity_type: "case_document",
    entity_id: doc.id,
  });

  // Registra evento na timeline do caso
  await sb.from("system_case_events").insert({
    case_id: doc.case_id,
    organization_id: doc.organization_id,
    action: "doc_deleted",
    diff: { doc_title: doc.title, doc_id: doc.id },
    triggered_by: triggeredBy ?? null,
  });

  return { ok: true as const, id: doc.id };
}
