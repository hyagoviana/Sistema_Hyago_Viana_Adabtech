import { Readable } from "node:stream";

import { JWT } from "google-auth-library";
import { google, type drive_v3 } from "googleapis";

const DEFAULT_SCOPES = ["https://www.googleapis.com/auth/drive"];

let cached: drive_v3.Drive | null = null;

function getEnv() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null;
  const scopesEnv = process.env.GOOGLE_DRIVE_SCOPES?.trim();

  if (!email || !rawKey || !rootFolderId) {
    throw new DriveError(
      "Drive: variáveis de ambiente ausentes (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_ROOT_FOLDER_ID).",
    );
  }

  return {
    email,
    privateKey: rawKey.replace(/\\n/g, "\n"),
    rootFolderId,
    sharedDriveId,
    scopes: scopesEnv ? scopesEnv.split(",").map((s) => s.trim()) : DEFAULT_SCOPES,
  };
}

export function getDriveClient(): drive_v3.Drive {
  if (cached) return cached;
  const env = getEnv();
  const auth = new JWT({ email: env.email, key: env.privateKey, scopes: env.scopes });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

export function getRootFolderId(): string {
  return getEnv().rootFolderId;
}

// Params para operações em um único arquivo (get/create/update/delete).
// `driveId` e `corpora` são parâmetros de busca — incluir em delete causa 404.
function writeParams() {
  const { sharedDriveId } = getEnv();
  return sharedDriveId ? { supportsAllDrives: true } : {};
}

// Params para list/search — precisa indicar onde procurar.
function searchParams() {
  const { sharedDriveId } = getEnv();
  if (!sharedDriveId) return {};
  return {
    supportsAllDrives: true,
    driveId: sharedDriveId,
    includeItemsFromAllDrives: true,
    corpora: "drive" as const,
  };
}

// ----------------------------------------------------------------------------
// Error com sanitização — esconde private key, stack interno do googleapis,
// e qualquer string longa que pareça PEM. Pode ser logado/serializado sem risco.
// ----------------------------------------------------------------------------
export class DriveError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly safeCause?: string;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DriveError";
    const parsed = parseGoogleError(cause);
    this.status = parsed.status;
    this.code = parsed.code;
    this.safeCause = parsed.safeMessage;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      cause: this.safeCause,
    };
  }
}

function parseGoogleError(cause: unknown): {
  status?: number;
  code?: string;
  safeMessage?: string;
} {
  if (!cause) return {};
  const c = cause as {
    code?: number | string;
    status?: number;
    message?: string;
    errors?: Array<{ message?: string; reason?: string }>;
  };
  const status =
    typeof c.status === "number" ? c.status : typeof c.code === "number" ? c.code : undefined;
  const reason = c.errors?.[0]?.reason;
  const rawMessage = c.errors?.[0]?.message ?? c.message ?? String(cause);
  return {
    status,
    code: typeof c.code === "string" ? c.code : reason,
    safeMessage: sanitizeMessage(rawMessage),
  };
}

const PEM_PATTERN = /-----BEGIN[\s\S]*?-----END[^-]*-----/g;
const LONG_BASE64 = /[A-Za-z0-9+/]{80,}={0,2}/g;

function sanitizeMessage(msg: string): string {
  if (!msg) return "";
  return msg
    .replace(PEM_PATTERN, "[REDACTED_PEM]")
    .replace(LONG_BASE64, "[REDACTED]")
    .slice(0, 1000);
}

// ----------------------------------------------------------------------------
// Operações
// ----------------------------------------------------------------------------

export type DriveFolder = { id: string; url: string; name: string };
export type DriveFile = { id: string; url: string; name: string; size: number; mimeType: string };

export async function createFolder(name: string, parentId?: string): Promise<DriveFolder> {
  const drive = getDriveClient();
  const parent = parentId ?? getRootFolderId();
  try {
    const res = await drive.files.create({
      ...writeParams(),
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parent],
      },
      fields: "id, name, webViewLink",
    });

    const folderId = res.data.id!;

    // Compartilha a pasta como "qualquer pessoa com o link pode visualizar"
    // para que os usuários do sistema consigam ver e baixar arquivos.
    await drive.permissions.create({
      fileId: folderId,
      ...writeParams(),
      requestBody: { type: "anyone", role: "reader" },
    });

    return {
      id: folderId,
      url: res.data.webViewLink!,
      name: res.data.name ?? name,
    };
  } catch (err) {
    throw new DriveError(`Falha ao criar pasta "${name}".`, err);
  }
}

// Renomeia uma pasta (ou arquivo) no Drive. Best-effort para o caller: usado ao
// renomear um TEMA para manter a pasta do tema com o nome atual (T2).
export async function renameFolder(fileId: string, name: string): Promise<void> {
  const drive = getDriveClient();
  try {
    await drive.files.update({
      fileId,
      requestBody: { name },
      ...writeParams(),
    });
  } catch (err) {
    throw new DriveError(`Falha ao renomear a pasta ${fileId}.`, err);
  }
}

export async function uploadFile(opts: {
  parentId: string;
  name: string;
  mimeType: string;
  body: Buffer | Readable;
}): Promise<DriveFile> {
  const drive = getDriveClient();
  try {
    const res = await drive.files.create({
      ...writeParams(),
      requestBody: {
        name: opts.name,
        parents: [opts.parentId],
        mimeType: opts.mimeType,
      },
      media: {
        mimeType: opts.mimeType,
        body: opts.body instanceof Buffer ? Readable.from(opts.body) : opts.body,
      },
      fields: "id, name, webViewLink, size, mimeType",
    });
    return {
      id: res.data.id!,
      url: res.data.webViewLink!,
      name: res.data.name ?? opts.name,
      size: Number(res.data.size ?? 0),
      mimeType: res.data.mimeType ?? opts.mimeType,
    };
  } catch (err) {
    throw new DriveError(`Falha ao subir arquivo "${opts.name}".`, err);
  }
}

export async function downloadFile(fileId: string): Promise<Readable> {
  const drive = getDriveClient();
  try {
    const res = await drive.files.get(
      { fileId, alt: "media", ...writeParams() },
      { responseType: "stream" },
    );
    return res.data as unknown as Readable;
  } catch (err) {
    throw new DriveError(`Falha ao baixar arquivo ${fileId}.`, err);
  }
}

// Em Shared Drives, Service Accounts com role "Gerenciador de conteúdo" NÃO podem
// deletar permanentemente — só mover pra lixeira. A lixeira do Shared Drive limpa
// automaticamente em 30 dias. Pra MVP, trash é equivalente a delete (sumiu da UI).
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  try {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      ...writeParams(),
    });
  } catch (err) {
    throw new DriveError(`Falha ao mover arquivo ${fileId} para a lixeira.`, err);
  }
}

/**
 * MOVE um arquivo para outra pasta (D1). No Drive mover é trocar o `parents` —
 * o fileId NÃO muda, então `drive_file_id` e `drive_url` já gravados continuam
 * válidos. Se algum dia um link quebrar depois de um move, é sinal de que a
 * implementação copiou em vez de mover.
 */
export async function moveFile(
  fileId: string,
  addParentId: string,
  removeParentId?: string,
): Promise<void> {
  const drive = getDriveClient();
  try {
    await drive.files.update({
      fileId,
      addParents: addParentId,
      ...(removeParentId ? { removeParents: removeParentId } : {}),
      requestBody: {},
      ...writeParams(),
    });
  } catch (err) {
    throw new DriveError(`Falha ao mover o arquivo ${fileId} para a pasta ${addParentId}.`, err);
  }
}

export async function getFileMeta(fileId: string) {
  const drive = getDriveClient();
  try {
    const res = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, webViewLink, createdTime, modifiedTime, parents",
      ...writeParams(),
    });
    return res.data;
  } catch (err) {
    throw new DriveError(`Falha ao ler metadado de ${fileId}.`, err);
  }
}

export async function listFilesInFolder(parentId: string, pageSize = 100) {
  const drive = getDriveClient();
  try {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, size, webViewLink, createdTime)",
      pageSize,
      ...searchParams(),
    });
    return res.data.files ?? [];
  } catch (err) {
    throw new DriveError(`Falha ao listar arquivos da pasta ${parentId}.`, err);
  }
}

// Lista SÓ as subpastas (folders) de um pai — usado para o admin escolher qual
// pasta de "modelos"/"procuração" vincular a um tema (T3).
export async function listFoldersInFolder(
  parentId: string,
  pageSize = 200,
): Promise<{ id: string; name: string; url: string }[]> {
  const drive = getDriveClient();
  try {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name, webViewLink)",
      orderBy: "name",
      pageSize,
      ...searchParams(),
    });
    return (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name ?? "",
      url: f.webViewLink ?? "",
    }));
  } catch (err) {
    throw new DriveError(`Falha ao listar subpastas da pasta ${parentId}.`, err);
  }
}
