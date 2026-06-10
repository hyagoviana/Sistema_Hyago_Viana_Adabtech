// Motor de geração de documentos via Google Docs (conta-sistema, OAuth2).
// Distinto do drive.ts (Service Account): aqui usamos a identidade OAuth da
// conta-sistema, que é DONA dos modelos e dos documentos gerados — necessário
// para o editor embutido (link-editável) funcionar sem login por usuário.
// SERVER-ONLY.

import { google, type docs_v1, type drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

let cachedAuth: OAuth2Client | null = null;

function getAuth(): OAuth2Client {
  if (cachedAuth) return cachedAuth;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new DocsError(
      "Google Docs: faltam GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN no ambiente.",
    );
  }
  const c = new OAuth2Client(clientId, clientSecret);
  c.setCredentials({ refresh_token: refreshToken });
  cachedAuth = c;
  return c;
}

let cachedDocs: docs_v1.Docs | null = null;
let cachedDrive: drive_v3.Drive | null = null;

function docsClient(): docs_v1.Docs {
  return (cachedDocs ??= google.docs({ version: "v1", auth: getAuth() }));
}
function driveClient(): drive_v3.Drive {
  return (cachedDrive ??= google.drive({ version: "v3", auth: getAuth() }));
}

// Extrai status + razão legível de um erro da Google API (googleapis/gaxios).
function googleErrorDetail(cause: unknown): { status?: number; reason?: string } {
  const e = cause as
    | {
        code?: number | string;
        status?: number;
        message?: string;
        response?: { status?: number; data?: { error?: { code?: number; message?: string } } };
        errors?: Array<{ message?: string; reason?: string }>;
      }
    | undefined;
  const status =
    e?.response?.status ??
    (typeof e?.status === "number" ? e.status : undefined) ??
    e?.response?.data?.error?.code ??
    (typeof e?.code === "number" ? e.code : undefined);
  const reason =
    e?.response?.data?.error?.message ?? e?.errors?.[0]?.message ?? e?.message ?? undefined;
  return { status, reason };
}

export class DocsError extends Error {
  readonly status?: number;
  constructor(message: string, cause?: unknown) {
    const { status, reason } = cause ? googleErrorDetail(cause) : {};
    // Anexa o motivo REAL do Google (ex.: "File not found" / "insufficient
    // permission") + o código HTTP — senão o erro vira opaco em produção.
    const full = reason ? `${message} → ${reason}${status ? ` (HTTP ${status})` : ""}` : message;
    super(full);
    this.name = "DocsError";
    this.status = status;
  }
}

// ----------------------------------------------------------------------------

/** Copia um modelo (Google Doc ou .docx) para uma nova cópia Google Doc nativa.
 *  Se o original for .docx, converte automaticamente para Google Doc ao copiar. */
export async function copyTemplate(
  templateId: string,
  name: string,
  parentFolderId?: string,
): Promise<{ id: string; url: string }> {
  try {
    const res = await driveClient().files.copy({
      fileId: templateId,
      supportsAllDrives: true,
      requestBody: {
        name,
        parents: parentFolderId ? [parentFolderId] : undefined,
        // Força conversão para Google Doc nativo (necessário para replacePlaceholders)
        mimeType: "application/vnd.google-apps.document",
      },
      fields: "id, webViewLink",
    });
    return { id: res.data.id!, url: res.data.webViewLink ?? docUrl(res.data.id!) };
  } catch (err) {
    throw new DocsError(`Falha ao copiar modelo ${templateId}.`, err);
  }
}

/** Substitui placeholders <campo> pelo valor. Ex: { nome: "João" } troca <nome>. */
export async function replacePlaceholders(
  documentId: string,
  values: Record<string, string>,
): Promise<void> {
  const requests = Object.entries(values).map(([key, value]) => ({
    replaceAllText: {
      containsText: { text: `<${key}>`, matchCase: true },
      replaceText: value ?? "",
    },
  }));
  if (requests.length === 0) return;
  try {
    await docsClient().documents.batchUpdate({ documentId, requestBody: { requests } });
  } catch (err) {
    throw new DocsError(`Falha ao substituir placeholders em ${documentId}.`, err);
  }
}

/** Exporta o documento como PDF (bytes). */
export async function exportPdf(documentId: string): Promise<Buffer> {
  try {
    const res = await driveClient().files.export(
      { fileId: documentId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(res.data as ArrayBuffer);
  } catch (err) {
    throw new DocsError(`Falha ao exportar PDF de ${documentId}.`, err);
  }
}

/** Exporta como DOCX editável (bytes). */
export async function exportDocx(documentId: string): Promise<Buffer> {
  try {
    const res = await driveClient().files.export(
      {
        fileId: documentId,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(res.data as ArrayBuffer);
  } catch (err) {
    throw new DocsError(`Falha ao exportar DOCX de ${documentId}.`, err);
  }
}

/** Torna o doc editável por link (edição anônima) — para o editor embutido. */
export async function setLinkEditable(documentId: string): Promise<void> {
  try {
    await driveClient().permissions.create({
      fileId: documentId,
      supportsAllDrives: true,
      requestBody: { type: "anyone", role: "writer" },
    });
  } catch (err) {
    throw new DocsError(`Falha ao tornar ${documentId} editável por link.`, err);
  }
}

/** Trava o doc (remove a permissão pública de edição) ao finalizar. */
export async function lockDocument(documentId: string): Promise<void> {
  try {
    const perms = await driveClient().permissions.list({
      fileId: documentId,
      supportsAllDrives: true,
      fields: "permissions(id,type,role)",
    });
    const anyone = perms.data.permissions?.find((p) => p.type === "anyone");
    if (anyone?.id) {
      await driveClient().permissions.delete({
        fileId: documentId,
        permissionId: anyone.id,
        supportsAllDrives: true,
      });
    }
  } catch (err) {
    throw new DocsError(`Falha ao travar ${documentId}.`, err);
  }
}

/** URL de edição embutível do Google Docs. */
export function docUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}

// --- Helper de teste: cria um Doc com texto inicial (não usado em produção) ---
export async function createDocWithText(title: string, text: string): Promise<string> {
  const created = await docsClient().documents.create({ requestBody: { title } });
  const id = created.data.documentId!;
  await docsClient().documents.batchUpdate({
    documentId: id,
    requestBody: { requests: [{ insertText: { location: { index: 1 }, text } }] },
  });
  return id;
}
