// Lógica do recebimento automático do ZapSign (webhook "documento assinado").
// SERVER-ONLY. A rota /api/webhooks/zapsign chama processZapsignWebhook().
//
// Princípio: o ZapSign EMPURRA o evento. A gente NÃO fica buscando.
// O corpo do webhook já traz o signed_file; só reconfirmamos pela API (getDocument)
// se o corpo vier incompleto — reconferência interna, invisível pro usuário.

import { createFolder, getRootFolderId, listFilesInFolder, uploadFile } from "../google/drive";
import { getDocument } from "./client";

const INBOX_NAME = "ZapSign - Recebidos";

export type ZapsignWebhookResult =
  | { ok: true; action: "stored"; docToken: string; fileUrl: string; folderUrl: string }
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
  const externalId = payload.external_id ?? null;
  return { token, status, signedFile, externalId };
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

  // Baixa o PDF assinado ORIGINAL (preserva a certificação — não recria/copia).
  const res = await fetch(signedFile);
  if (!res.ok) throw new Error(`Falha ao baixar signed_file (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // TODO(DOC-1): localizar a pasta do CASO via system_case_documents.zapsign_doc_token.
  // Enquanto a tabela não existe, cai na caixa de entrada "ZapSign - Recebidos".
  const inbox = await findOrCreateInbox();
  const file = await uploadFile({
    parentId: inbox.id,
    name: `assinado-${token.slice(0, 8)}.pdf`,
    mimeType: "application/pdf",
    body: buffer,
  });

  return { ok: true, action: "stored", docToken: token, fileUrl: file.url, folderUrl: inbox.url };
}
