// Lógica do recebimento automático do ZapSign (webhook "documento assinado").
// SERVER-ONLY. A rota /api/webhooks/zapsign chama processZapsignWebhook().
//
// Princípio: o ZapSign EMPURRA o evento. A gente NÃO fica buscando.
// O corpo do webhook já traz o signed_file; só reconfirmamos pela API (getDocument)
// se o corpo vier incompleto — reconferência interna, invisível pro usuário.
//
// Idempotência (B4): cada doc assinado é processado uma única vez (system_webhook_dedupe).
// Destino: se o token casar com um system_case_documents, cai na PASTA DO CASO;
// senão, na caixa "ZapSign - Recebidos".

import { ensureCaseFolder } from "../case-documents-service";
import { createFolder, getRootFolderId, listFilesInFolder, uploadFile } from "../google/drive";
import { getSupabaseAdmin } from "../supabase/server";
import type { Json } from "../supabase/types";
import { getDocument } from "./client";

const INBOX_NAME = "ZapSign - Recebidos";

export type ZapsignWebhookResult =
  | { ok: true; action: "stored"; docToken: string; fileUrl: string; folderUrl: string; target: "case" | "inbox" }
  | { ok: true; action: "ignored"; reason: string; docToken?: string };

type AnyPayload = Record<string, unknown> & {
  token?: string;
  status?: string;
  signed_file?: string | null;
  external_id?: string | null;
  doc?: { token?: string; status?: string; signed_file?: string | null };
};

function pick(payload: AnyPayload) {
  const token = payload.token ?? payload.doc?.token;
  const status = payload.status ?? payload.doc?.status;
  const signedFile = payload.signed_file ?? payload.doc?.signed_file ?? null;
  return { token, status, signedFile };
}

async function findOrCreateInbox(): Promise<{ id: string; url: string }> {
  const root = getRootFolderId();
  const files = await listFilesInFolder(root);
  const existing = files.find(
    (f) => f.name === INBOX_NAME && f.mimeType === "application/vnd.google-apps.folder",
  );
  if (existing?.id) {
    return { id: existing.id, url: `https://drive.google.com/drive/folders/${existing.id}` };
  }
  const folder = await createFolder(INBOX_NAME, root);
  return { id: folder.id, url: folder.url };
}

export async function processZapsignWebhook(payload: AnyPayload): Promise<ZapsignWebhookResult> {
  let { token, status, signedFile } = pick(payload);

  if (!token) {
    return { ok: true, action: "ignored", reason: "payload sem token de documento" };
  }

  // Reconfirmação interna só se o corpo veio sem o arquivo assinado.
  if (!signedFile || status !== "signed") {
    const doc = await getDocument(token);
    status = doc.status;
    signedFile = doc.signed_file;
  }

  if (status !== "signed" || !signedFile) {
    return { ok: true, action: "ignored", reason: `status=${status ?? "?"} (ainda não assinado)`, docToken: token };
  }

  const sb = getSupabaseAdmin();

  // B4 — Idempotência: só processa o "assinado" deste token uma vez.
  const { error: dupErr } = await sb
    .from("system_webhook_dedupe")
    .insert({ provider: "zapsign", external_id: token, event_type: "signed", payload: payload as unknown as Json });
  if (dupErr) {
    if (dupErr.code === "23505") {
      return { ok: true, action: "ignored", reason: "evento já processado (dedupe)", docToken: token };
    }
    throw new Error(`dedupe falhou: ${dupErr.message}`);
  }

  // Baixa o PDF assinado ORIGINAL (preserva a certificação — não recria/copia).
  const res = await fetch(signedFile);
  if (!res.ok) throw new Error(`Falha ao baixar signed_file (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // Tenta achar o documento do caso pelo token → pasta do caso.
  const { data: caseDoc } = await sb
    .from("system_case_documents")
    .select("id, case_id, organization_id, title")
    .eq("zapsign_doc_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (caseDoc?.case_id) {
    const { folderId, folderUrl } = await ensureCaseFolder(caseDoc.case_id);
    const file = await uploadFile({
      parentId: folderId,
      name: `assinado-${caseDoc.title ?? token.slice(0, 8)}.pdf`,
      mimeType: "application/pdf",
      body: buffer,
    });
    await sb
      .from("system_case_documents")
      .update({ status: "ASSINADO", drive_file_id: file.id, drive_url: file.url })
      .eq("id", caseDoc.id);
    await sb.from("system_audit_log").insert({
      organization_id: caseDoc.organization_id,
      action: "case_document.signed_received",
      entity_type: "case_document",
      entity_id: caseDoc.id,
      diff: { zapsign_doc_token: token, drive_file_id: file.id },
    });
    return {
      ok: true,
      action: "stored",
      docToken: token,
      fileUrl: file.url,
      folderUrl: folderUrl ?? "",
      target: "case",
    };
  }

  // Fallback: caixa de entrada "ZapSign - Recebidos".
  const inbox = await findOrCreateInbox();
  const file = await uploadFile({
    parentId: inbox.id,
    name: `assinado-${token.slice(0, 8)}.pdf`,
    mimeType: "application/pdf",
    body: buffer,
  });
  return { ok: true, action: "stored", docToken: token, fileUrl: file.url, folderUrl: inbox.url, target: "inbox" };
}
