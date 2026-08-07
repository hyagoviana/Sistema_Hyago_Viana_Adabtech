// Server-only — orquestra documentos de cliente (Drive + Supabase + audit).
// NUNCA importe em código que roda no browser.

import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { deleteFile as trashDriveFile, downloadFile, DriveError, uploadFile } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";
import { validateUpload } from "./validators/file";

export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

// ----------------------------------------------------------------------------
// LIST
// ----------------------------------------------------------------------------
export async function listClientDocuments(clientId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_client_documents_active")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new DocumentServiceError(error.message, 500);
  return data ?? [];
}

// ----------------------------------------------------------------------------
// UPLOAD
// ----------------------------------------------------------------------------
export async function uploadClientDocument(opts: {
  clientId: string;
  fileName: string;
  mimeType: string;
  description?: string | null;
  buffer: Buffer;
}) {
  const validation = validateUpload({
    name: opts.fileName,
    mimeType: opts.mimeType,
    size: opts.buffer.length,
    head: opts.buffer.subarray(0, 16),
  });
  if (!validation.ok) {
    throw new DocumentServiceError(validation.reason, validation.status);
  }

  const sb = getSupabaseAdmin();

  // 1) Buscar cliente + pasta
  const { data: client, error: clientErr } = await sb
    .from("system_clients")
    .select("id, organization_id, drive_folder_id")
    .eq("id", opts.clientId)
    .is("deleted_at", null)
    .single();
  if (clientErr || !client) {
    throw new DocumentServiceError("Cliente não encontrado", 404);
  }
  if (!client.drive_folder_id) {
    throw new DocumentServiceError(
      "Cliente sem pasta no Drive · use 'Tentar de novo' na ficha pra criar antes de subir documentos",
      409,
    );
  }

  // 2) Hash
  const sha256 = createHash("sha256").update(opts.buffer).digest("hex");

  // 3) Upload no Drive
  let driveResult;
  try {
    driveResult = await uploadFile({
      parentId: client.drive_folder_id,
      name: opts.fileName,
      mimeType: opts.mimeType,
      body: opts.buffer,
    });
  } catch (err) {
    const msg =
      err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
    throw new DocumentServiceError(`Falha ao enviar pro Drive: ${msg}`, 502);
  }

  // 4) Gravar metadado — se falhar, rollback no Drive (best effort)
  const { data: doc, error: docErr } = await sb
    .from("system_client_documents")
    .insert({
      client_id: client.id,
      organization_id: client.organization_id,
      name: opts.fileName,
      description: opts.description ?? null,
      drive_file_id: driveResult.id,
      drive_url: driveResult.url,
      mime_type: driveResult.mimeType,
      size_bytes: driveResult.size,
      sha256,
    })
    .select()
    .single();

  if (docErr || !doc) {
    try {
      await trashDriveFile(driveResult.id);
    } catch (cleanupErr) {
      console.error("documents-service: rollback Drive falhou:", cleanupErr);
    }
    throw new DocumentServiceError(`Falha ao gravar metadado (${docErr?.message ?? "?"})`, 500);
  }

  // 5) Audit
  await sb.from("system_audit_log").insert({
    organization_id: client.organization_id,
    action: "document.upload",
    entity_type: "document",
    entity_id: doc.id,
    diff: { name: opts.fileName, size: opts.buffer.length, sha256 },
  });

  return doc;
}

// ----------------------------------------------------------------------------
// DOWNLOAD — retorna { meta, stream } pro caller envelopar em Response
// ----------------------------------------------------------------------------
export async function downloadClientDocument(opts: { clientId: string; docId: string }) {
  const sb = getSupabaseAdmin();
  const { data: doc, error } = await sb
    .from("system_client_documents")
    .select("*")
    .eq("id", opts.docId)
    .eq("client_id", opts.clientId)
    .is("deleted_at", null)
    .single();
  if (error || !doc) throw new DocumentServiceError("Documento não encontrado", 404);

  let stream: Readable;
  try {
    stream = await downloadFile(doc.drive_file_id);
  } catch (err) {
    const msg = err instanceof DriveError ? err.message : String(err);
    throw new DocumentServiceError(`Falha ao baixar do Drive: ${msg}`, 502);
  }

  // Audit
  await sb.from("system_audit_log").insert({
    organization_id: doc.organization_id,
    action: "document.download",
    entity_type: "document",
    entity_id: doc.id,
  });

  return { doc, stream };
}

// ----------------------------------------------------------------------------
// DELETE — soft no banco + trash no Drive (best effort)
// ----------------------------------------------------------------------------
export async function deleteClientDocument(opts: { clientId: string; docId: string }) {
  const sb = getSupabaseAdmin();
  const { data: doc, error } = await sb
    .from("system_client_documents")
    .select("*")
    .eq("id", opts.docId)
    .eq("client_id", opts.clientId)
    .is("deleted_at", null)
    .single();
  if (error || !doc) throw new DocumentServiceError("Documento não encontrado", 404);

  await sb
    .from("system_client_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", doc.id);

  let driveTrashed = true;
  try {
    await trashDriveFile(doc.drive_file_id);
  } catch (err) {
    driveTrashed = false;
    console.error("documents-service: falha ao mover arquivo Drive pra lixeira:", err);
  }

  await sb.from("system_audit_log").insert({
    organization_id: doc.organization_id,
    action: "document.delete",
    entity_type: "document",
    entity_id: doc.id,
    diff: { drive_trashed: driveTrashed },
  });

  return { ok: true as const, id: doc.id, drive_trashed: driveTrashed };
}

// ----------------------------------------------------------------------------
// Helper: Node Readable → Web ReadableStream (pra usar em Response)
// ----------------------------------------------------------------------------
export function nodeStreamToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
      );
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });
}
