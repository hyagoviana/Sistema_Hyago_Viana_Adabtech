// Server-only — orquestra documentos do CASO: gerar (Google Docs) → editar
// (embutido) → finalizar (PDF na pasta do caso) → enviar ao ZapSign.
// Identidades: Google Docs/edição = conta-sistema OAuth (docs.ts);
// storage da pasta do caso = Service Account (drive.ts). NUNCA no browser.

import { createHash } from "node:crypto";

import { sugerirChecklistPorUpload } from "./checklist-service";
import {
  createFolder,
  deleteFile as trashDriveFile,
  listFoldersInFolder,
  uploadFile,
  DriveError,
} from "./google/drive";
import { validateUpload } from "./validators/file";
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
import type { Json } from "./supabase/types";
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

/**
 * D1 (reunião 2026-08-26) — nome da subpasta que recebe TUDO que o SHV gera.
 * Uma constante só: o AC de "adoção" depende de bater o nome exato.
 */
export const PASTA_DOCS_AUTOMATICOS = "Documentos automáticos";

/**
 * Subpasta "Documentos automáticos" DENTRO da pasta do caso (idempotente).
 *
 * Thiago: "o sistema criou a pasta do caso da pessoa… quando a gente gera o
 * documento, ele joga aqui no todo. E aí você tem um cliente com 40 documentos
 * aqui. Na hora que ele cria essa pasta desse caso, ele já cria uma pasta
 * documento automático de uma vez só."
 *
 * Regra do owner: só o que o SISTEMA gera vai para cá. Anexo manual continua na
 * raiz da pasta do caso.
 *
 * Ordem de resolução: (1) id já gravado; (2) pasta existente com esse nome —
 * ADOTA em vez de criar uma segunda; (3) cria.
 */
export async function ensureCaseAutoFolder(caseId: string): Promise<{
  folderId: string;
  folderUrl: string | null;
}> {
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("id, drive_auto_folder_id, drive_auto_folder_url")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();

  const jaGravada = (caso as { drive_auto_folder_id?: string | null } | null)?.drive_auto_folder_id;
  if (jaGravada) {
    return {
      folderId: jaGravada,
      folderUrl:
        (caso as { drive_auto_folder_url?: string | null } | null)?.drive_auto_folder_url ?? null,
    };
  }

  // Garante a pasta do caso antes (é o pai da subpasta).
  const { folderId: caseFolderId } = await ensureCaseFolder(caseId);

  // Adoção: se a pasta já existe no Drive (criada à mão ou por execução anterior
  // que não gravou o id), reusa — nunca cria uma segunda com o mesmo nome.
  let alvo: { id: string; url: string | null } | null = null;
  try {
    const existentes = await listFoldersInFolder(caseFolderId);
    const achada = existentes.find(
      (f) => f.name.trim().toLowerCase() === PASTA_DOCS_AUTOMATICOS.toLowerCase(),
    );
    if (achada) alvo = { id: achada.id, url: achada.url || null };
  } catch (err) {
    // Listar é só otimização; se falhar, segue para a criação.
    console.error("ensureCaseAutoFolder: falha ao listar subpastas:", err);
  }

  if (!alvo) {
    const criada = await createFolder(PASTA_DOCS_AUTOMATICOS, caseFolderId);
    alvo = { id: criada.id, url: criada.url || null };
  }

  await sb
    .from("system_cases")
    .update({ drive_auto_folder_id: alvo.id, drive_auto_folder_url: alvo.url } as never)
    .eq("id", caseId);

  return { folderId: alvo.id, folderUrl: alvo.url };
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

  // R5-03 (B4): fallback do cenário "cliente sem pasta no Drive" (drive_sync_failed).
  // Antes de falhar, tenta criar/ressincronizar a pasta do cliente automaticamente
  // (reusa resyncClientDriveFolder de clients-service). Só se AINDA assim faltar é
  // que devolvemos um erro ACIONÁVEL — nunca um 409 seco sem instrução.
  let clientFolderId = client?.drive_folder_id ?? null;
  if (cErr || !clientFolderId) {
    if (caso.client_id) {
      try {
        const { resyncClientDriveFolder } = await import("./clients-service");
        const res = await resyncClientDriveFolder(caso.client_id);
        clientFolderId =
          res.folderId ??
          (res as { folder?: { drive_folder_id?: string | null } }).folder?.drive_folder_id ??
          null;
      } catch (resyncErr) {
        console.error("ensureCaseFolder: resync automático da pasta do cliente falhou:", resyncErr);
      }
    }
    if (!clientFolderId) {
      throw new CaseDocumentServiceError(
        'O cliente não tem pasta no Drive e a criação automática falhou. Abra a ficha do cliente e use "Sincronizar pasta do Drive", depois tente anexar novamente.',
        409,
      );
    }
  }

  try {
    const folder = await createFolder(`Caso-${caso.case_code}`, clientFolderId);
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
// UPLOAD — anexa um arquivo (PDF/Word) direto na pasta do CASO no Drive e
// registra em system_case_documents (source='UPLOAD', status='FINALIZADO').
// Segue o padrão do upload de documentos do CLIENTE (magic-bytes anti-spoofing),
// restringindo os tipos a PDF/DOC/DOCX.
// ----------------------------------------------------------------------------
const UPLOAD_ALLOWED_MIMES = new Set<string>([
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

const UPLOAD_ALLOWED_LABEL = "PDF, DOC ou DOCX";

// R5-03 (B4) candidato #2: alguns browsers/OS enviam File.type vazio ou
// "application/octet-stream" (típico p/ .doc/.docx dependendo do MIME registrado
// no sistema), o que fazia o upload cair como "Tipo não permitido" mesmo sendo um
// arquivo VÁLIDO. Quando o tipo declarado não é conclusivo, inferimos pela
// extensão do nome + magic-bytes do conteúdo (o validateUpload depois confirma).
export function resolveUploadMime(
  declaredMime: string,
  fileName: string,
  head: Buffer,
): string | null {
  if (UPLOAD_ALLOWED_MIMES.has(declaredMime)) return declaredMime;

  const inconclusive = !declaredMime || declaredMime === "application/octet-stream";
  if (!inconclusive) return null; // tipo declarado explícito e não permitido → rejeita

  const headHex = head.subarray(0, 8).toString("hex").toLowerCase();
  if (headHex.startsWith("25504446")) return "application/pdf"; // %PDF
  if (headHex.startsWith("d0cf11e0a1b11ae1")) return "application/msword"; // OLE (.doc)
  // Container ZIP (504b0304): .docx OU .doc-zip. Desambigua pela extensão do nome.
  const lower = fileName.toLowerCase();
  if (headHex.startsWith("504b0304")) {
    if (lower.endsWith(".docx"))
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  // Sem magic-byte conclusivo: cai pra extensão declarada.
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  return null;
}

export async function uploadCaseDocument(opts: {
  caseId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  triggeredBy?: string;
}) {
  // Restringe o tipo ANTES do magic-bytes (que aceita mais formatos). Quando o
  // browser envia .type vazio/octet-stream (comum p/ .doc/.docx), tenta inferir o
  // tipo real por extensão + magic-bytes em vez de rejeitar um arquivo válido.
  const resolvedMime = resolveUploadMime(opts.mimeType, opts.fileName, opts.buffer.subarray(0, 8));
  if (!resolvedMime) {
    throw new CaseDocumentServiceError(
      `Tipo de arquivo não suportado (${opts.mimeType || "desconhecido"}). Aceitamos apenas ${UPLOAD_ALLOWED_LABEL}.`,
      415,
    );
  }

  const validation = validateUpload({
    name: opts.fileName,
    mimeType: resolvedMime,
    size: opts.buffer.length,
    head: opts.buffer.subarray(0, 16),
  });
  if (!validation.ok) {
    throw new CaseDocumentServiceError(validation.reason, validation.status);
  }

  const sb = getSupabaseAdmin();
  const { data: caso, error: caseErr } = await sb
    .from("system_cases")
    .select("id, organization_id")
    .eq("id", opts.caseId)
    .is("deleted_at", null)
    .single();
  if (caseErr || !caso) throw new CaseDocumentServiceError("Caso não encontrado", 404);

  // Garante a pasta do caso no Drive (idempotente).
  const { folderId } = await ensureCaseFolder(opts.caseId);

  let drive;
  try {
    drive = await uploadFile({
      parentId: folderId,
      name: opts.fileName,
      mimeType: resolvedMime,
      body: opts.buffer,
    });
  } catch (err) {
    const msg =
      err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
    throw new CaseDocumentServiceError(
      `Falha ao subir na pasta do caso: ${msg}`,
      EXTERNAL_DEP_FAILED,
    );
  }

  const { data: doc, error: insErr } = await sb
    .from("system_case_documents")
    .insert({
      case_id: caso.id,
      organization_id: caso.organization_id,
      title: opts.fileName,
      status: "FINALIZADO",
      source: "UPLOAD",
      drive_file_id: drive.id,
      drive_url: drive.url,
      mime_type: drive.mimeType,
      size_bytes: drive.size,
      sha256: sha256Hex(opts.buffer),
    })
    .select()
    .single();

  if (insErr || !doc) {
    // Rollback best-effort no Drive.
    try {
      await trashDriveFile(drive.id);
    } catch (cleanupErr) {
      console.error("case-documents-service: rollback Drive falhou:", cleanupErr);
    }
    throw new CaseDocumentServiceError(
      `Falha ao gravar documento (${insErr?.message ?? "?"})`,
      500,
    );
  }

  await sb.from("system_audit_log").insert({
    organization_id: caso.organization_id,
    action: "case_document.upload",
    entity_type: "case_document",
    entity_id: doc.id,
    diff: { name: opts.fileName, size: opts.buffer.length, drive_file_id: drive.id },
  });

  await sb.from("system_case_events").insert({
    case_id: caso.id,
    organization_id: caso.organization_id,
    action: "doc_uploaded",
    diff: { doc_title: opts.fileName, doc_id: doc.id },
    triggered_by: opts.triggeredBy ?? null,
  });

  // Gancho de auto-check por upload (mesmo do finalize) — no-op quando desligado.
  await sugerirChecklistPorUpload(caso.id, opts.fileName, drive.id).catch(() => {});

  return doc;
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

  // Garante a pasta ANTES de copiar — senão o Google Drive cria a cópia dentro
  // da pasta do modelo original (07-Modelos). D1: o destino do que o SISTEMA gera
  // é a subpasta "Documentos automáticos" (anexo manual continua na raiz).
  const { folderId: caseFolderId } = await ensureCaseAutoFolder(opts.caseId);

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
      // C1 (2026-07-20) — guarda os valores preenchidos; usados para pré-preencher
      // o Termo QUANDO este documento for ASSINADO (ver confirmarAssinatura...).
      values: (opts.values ?? {}) as unknown as Json,
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

  // Motor de variáveis (owner, 2026-07-21) — "preenche 1x no caso".
  // Persiste os valores dos campos MANUAIS DO CASO de volta em
  // system_cases.canonical_fields, para que a PRÓXIMA geração (caso E procuração,
  // pois ambos passam por aqui) já venha preenchida. Só campos `source==='manual'`
  // são congelados: os automáticos do cliente (`source==='auto'`) e os derivados
  // (município/honorários) re-derivam frescos a cada geração, então NÃO são
  // gravados. Datas de emissão ("data", "local e data") também não congelam.
  // Best-effort: falha aqui não derruba a geração do documento.
  try {
    await persistManualFieldsToCase(opts.caseId, fields, opts.values ?? {}, opts.triggeredBy);
  } catch (err) {
    console.warn(
      "[motor] Falha ao persistir campos do caso (best-effort):",
      err instanceof Error ? err.message : err,
    );
  }

  return { doc, editUrl: docUrl(docId) };
}

// R2-10 (2026-07-22) — "Documento de caso" gera um CASO PRÓPRIO. Cria um NOVO
// caso clonando cliente/tema/frente do caso de origem (+ a pasta escolhida) e
// gera o documento NELE. Reusa toda a lógica de createCase (código, etapas,
// pastas Drive) e generateCaseDocumentFromTemplate. Retorna o id do novo caso
// para a UI navegar e abrir o editor do Word. `docKind` é sempre 'contrato'
// (procuração NÃO passa por aqui — continua no caso atual).
export async function generateDocumentAsNewCase(opts: {
  sourceCaseId: string;
  templateId: string;
  title?: string;
  values: Record<string, string>;
  casoPastaNome?: string | null;
  casoPastaDriveId?: string | null;
  triggeredBy?: string;
}) {
  const sb = getSupabaseAdmin();
  const { data: src, error } = await sb
    .from("system_cases")
    .select("id, client_id, tema_id, frente_slug, case_type")
    .eq("id", opts.sourceCaseId)
    .is("deleted_at", null)
    .single();
  if (error || !src) throw new CaseDocumentServiceError("Caso de origem não encontrado", 404);

  // R2-11 (req.5) — se o caso de origem AINDA NÃO tem nenhum "documento de caso"
  // (doc_kind='contrato'), o PRIMEIRO fica NELE (procuração + caso juntos no mesmo
  // card). Do 2º em diante, cada "documento de caso" vira um caso novo (R2-10).
  const { count } = await sb
    .from("system_case_documents")
    .select("id", { count: "exact", head: true })
    .eq("case_id", opts.sourceCaseId)
    .eq("doc_kind", "contrato")
    .is("deleted_at", null);
  if ((count ?? 0) === 0) {
    const genHere = await generateCaseDocumentFromTemplate({
      caseId: opts.sourceCaseId,
      templateId: opts.templateId,
      title: opts.title,
      values: opts.values,
      docKind: "contrato",
      triggeredBy: opts.triggeredBy,
    });
    return { caseId: opts.sourceCaseId, ...genHere };
  }

  // Import dinâmico evita ciclo entre case-documents-service e cases-service.
  const { createCase } = await import("./cases-service");
  const novo = await createCase(
    {
      client_id: src.client_id,
      case_type: src.case_type,
      tema_id: src.tema_id ?? null,
      frente_slug: src.frente_slug ?? null,
      caso_pasta_nome: opts.casoPastaNome ?? null,
      caso_pasta_drive_id: opts.casoPastaDriveId ?? null,
    } as never,
    opts.triggeredBy,
  );

  const gen = await generateCaseDocumentFromTemplate({
    caseId: novo.id,
    templateId: opts.templateId,
    title: opts.title,
    values: opts.values,
    docKind: "contrato",
    triggeredBy: opts.triggeredBy,
  });

  return { caseId: novo.id, ...gen };
}

// Normaliza a chave do campo p/ detectar as datas de EMISSÃO (que não devem ser
// congeladas no caso — são sempre a data de geração). Mesma normalização do motor.
function isEmissaoDateKey(key: string): boolean {
  const nk = key
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*-\s*obrigat[oó]rio\s*$/i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
  return (
    nk === "data" || nk === "data extenso" || nk === "data por extenso" || nk === "local e data"
  );
}

// Grava em canonical_fields do caso os valores dos campos `source==='manual'`
// preenchidos na geração (exceto datas de emissão). Guarda sob o RÓTULO limpo do
// campo (sem "- obrigatório"), que o `canonicalLookup` do motor casa por
// normalização na próxima geração. Import dinâmico evita o ciclo com cases-service.
async function persistManualFieldsToCase(
  caseId: string,
  fields: Array<{ key: string; label?: string; source?: string }>,
  values: Record<string, string>,
  triggeredBy?: string,
): Promise<void> {
  const patch: Record<string, string> = {};
  for (const f of fields) {
    if (f.source !== "manual") continue; // automáticos do cliente ficam de fora
    if (isEmissaoDateKey(f.key)) continue; // data de emissão não congela
    const v = String(values?.[f.key] ?? "").trim();
    if (v) patch[(f.label || f.key).trim()] = v;
  }
  if (Object.keys(patch).length === 0) return;
  const { updateCaseCanonicalFields } = await import("./cases-service");
  await updateCaseCanonicalFields(caseId, patch, triggeredBy);
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

  // S2-06 — gancho de auto-check por upload (modo SUGESTÃO). No momento em que o
  // arquivo ganha drive_file_id, avalia o matcher parametrizável e cria sugestões
  // (source='drive_suggest', done=false). DESLIGADO por default (AUTO_CHECK_DRIVE_ENABLED);
  // enquanto desligado é no-op. Nunca marca done sozinho, nunca fecha o gate.
  await sugerirChecklistPorUpload(doc.case_id, fileName, drive.id).catch(() => {});

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

// Nome que o CLIENTE vê para assinar (ZapSign) e do PDF assinado salvo no Drive.
// Padrão por tipo (2026-07-10): "Procuração - {cliente}" ou "Contrato - {cliente}".
// Os nomes dos MODELOS nas pastas do Drive continuam como estão — isto é só o nome
// do documento gerado/enviado para assinatura.
export async function buildSignatureDocName(
  sb: ReturnType<typeof getSupabaseAdmin>,
  caseId: string,
  docKind: string | null | undefined,
): Promise<string> {
  const label = docKind === "procuracao" ? "Procuração" : "Contrato";
  const { data: caso } = await sb
    .from("system_cases")
    .select("client_id")
    .eq("id", caseId)
    .maybeSingle();
  let clientName = "";
  if (caso?.client_id) {
    const { data: cli } = await sb
      .from("system_clients")
      .select("full_name")
      .eq("id", caso.client_id)
      .maybeSingle();
    clientName = (cli?.full_name ?? "").trim();
  }
  return clientName ? `${label} - ${clientName}` : label;
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

  // Nome que o cliente assina: "Procuração - {cliente}" / "Contrato - {cliente}".
  const signatureName = await buildSignatureDocName(sb, doc.case_id, doc.doc_kind);
  const zdoc = await createDocument({
    name: signatureName,
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

  // S1-02/S1-07 + S9-12: o envio do documento de assinatura ao ZapSign é o ATO
  // que coloca o caso na fase COMERCIAL (aguardando assinatura). Aqui — e não na
  // criação do caso — setamos `aguardando_assinatura_at`, para o caso aparecer em
  // "Comercial · Aguardando assinatura" enquanto o cliente não assina.
  //   - procuracao : modelo antigo (procuração pura). Ao assinar, o webhook chama
  //     registrarProcuracaoAssinada (segue LEAD).
  //   - contrato   : modelo COMBINADO ("Contrato e procuração - [serviço]") — 1
  //     doc por caso. Ao assinar, o webhook chama promoverCasoOperacional
  //     (vira CLIENTE), que limpa `aguardando_assinatura_at` e sai do comercial.
  // Idempotente (não sobrescreve se já estava setado nem se já foi liberado/promovido).
  if ((doc.doc_kind === "procuracao" || doc.doc_kind === "contrato") && doc.case_id) {
    const { data: caso } = await sb
      .from("system_cases")
      .select("aguardando_assinatura_at, assinatura_liberada_at")
      .eq("id", doc.case_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (caso && !caso.aguardando_assinatura_at && !caso.assinatura_liberada_at) {
      await sb
        .from("system_cases")
        .update({ aguardando_assinatura_at: new Date().toISOString() })
        .eq("id", doc.case_id)
        .is("deleted_at", null);
    }
  }

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
// ITEM 5 (2026-07-06) — CONFIRMAR ASSINATURA MANUALMENTE.
// ----------------------------------------------------------------------------
// Caminho MANUAL equivalente ao webhook do ZapSign (que está adiado): marca o
// documento como ASSINADO e dispara o gatilho de ciclo de vida do caso:
//   - contrato   (doc COMBINADO) ⇒ promoverCasoOperacional → CLIENTE (vai ao
//     operacional; limpa aguardando_assinatura_at).
//   - procuracao (procuração pura) ⇒ registrarProcuracaoAssinada (segue LEAD,
//     sai do "aguardando assinatura", esteira comercial = GANHO).
// Idempotente: doc já ASSINADO → no-op de status; o gatilho de caso também é
// idempotente. Exige usuário autenticado (auditoria).
export async function confirmarAssinaturaManualDocumento(docId: string, userId: string) {
  if (!userId) throw new CaseDocumentServiceError("Ação exige usuário autenticado", 401);
  const sb = getSupabaseAdmin();
  const doc = await getCaseDocument(docId);

  if (doc.status !== "ASSINADO") {
    const { error } = await sb
      .from("system_case_documents")
      .update({ status: "ASSINADO" })
      .eq("id", doc.id);
    if (error) throw new CaseDocumentServiceError(error.message, 500);

    await sb.from("system_case_events").insert({
      case_id: doc.case_id,
      organization_id: doc.organization_id,
      action: "doc_assinado_manual",
      diff: { doc_title: doc.title, doc_id: doc.id, doc_kind: doc.doc_kind },
      triggered_by: userId,
    });
  }

  // Dispara o gatilho de ciclo de vida do caso conforme o tipo do documento.
  // Import dinâmico evita ciclo entre case-documents-service e cases-service.
  if (doc.case_id) {
    const {
      promoverCasoOperacional,
      registrarProcuracaoAssinada,
      honorariosFromValues,
      upsertCaseHonorarios,
    } = await import("./cases-service");
    // Procuração assinada: registra o marco comercial (procuracao_assinada_at + GANHO).
    if (doc.doc_kind === "procuracao") {
      await registrarProcuracaoAssinada(doc.case_id, { via: "manual", userId });
    }
    // REGRA (2026-07-08, owner): QUALQUER documento assinado — procuração, contrato
    // ou documento de caso — promove o cadastro a CLIENTE (passa a aparecer na aba
    // Clientes, não fica só em Lead). Idempotente (no-op se já é CLIENTE).
    await promoverCasoOperacional(doc.case_id, { via: "manual", userId });

    // C1 (2026-07-20, Adavio) — SÓ ao ASSINAR o contrato/procuração é que os valores
    // preenchidos no documento (%, parcela) "valem": capturamos do documento e
    // gravamos em system_case_honorarios, de onde o Termo de Acerto abre
    // pré-preenchido. Evita conferir o contrato na mão. Best-effort.
    if ((doc.doc_kind === "contrato" || doc.doc_kind === "procuracao") && doc.values) {
      try {
        const vals = doc.values as Record<string, string>;
        await upsertCaseHonorarios(
          doc.case_id,
          doc.organization_id,
          honorariosFromValues(vals),
          userId,
        );
      } catch (err) {
        console.error(
          "confirmarAssinaturaManualDocumento: falha ao capturar honorários do doc assinado:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return { ok: true as const, id: doc.id };
}

// ----------------------------------------------------------------------------
// SOFT DELETE
// ----------------------------------------------------------------------------
export async function softDeleteCaseDocument(
  docId: string,
  triggeredBy?: string,
  opts?: { cascadeTermo?: boolean },
) {
  const sb = getSupabaseAdmin();
  const doc = await getCaseDocument(docId);

  await sb
    .from("system_case_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", doc.id);

  // Apaga do Drive tanto o PDF finalizado (drive_file_id) quanto o Google Doc
  // editável (google_doc_id) — antes só o PDF ia pra lixeira, e o rascunho do
  // termo/documento continuava no Drive.
  for (const fileId of [doc.drive_file_id, doc.google_doc_id]) {
    if (!fileId) continue;
    try {
      await trashDriveFile(fileId);
    } catch (err) {
      console.error("case-documents-service: trash Drive falhou:", err);
    }
  }

  // Cascata bidirecional TERMO ↔ DOCUMENTO: excluir o documento de um termo
  // (doc_kind='TERMO_ACERTO') também apaga o rascunho do termo. O caminho inverso
  // (excluir pelo painel do termo) chama isto com cascadeTermo:false p/ não recursar.
  if (opts?.cascadeTermo !== false && (doc as { doc_kind?: string }).doc_kind === "TERMO_ACERTO") {
    await sb
      .from("system_termo_snapshots")
      .delete()
      .eq("case_id", doc.case_id)
      .eq("status", "RASCUNHO");
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
