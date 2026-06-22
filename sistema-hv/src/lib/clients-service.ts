// Server-only — orquestra CRUD de clientes (Supabase + Drive + audit).
// NUNCA importe este arquivo em código que roda no browser.

import slugify from "slugify";

import { createFolder, DriveError } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";
import type { Database, Json } from "./supabase/types";
import type { ClientCreateOutput, ClientUpdateOutput } from "./validators/client";

type ClientInsert = Database["public"]["Tables"]["system_clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["system_clients"]["Update"];

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class ClientServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "DUPLICATE_CPF" | "NOT_FOUND" | "DB_ERROR",
    public readonly status: number,
  ) {
    super(message);
    this.name = "ClientServiceError";
  }
}

function clientsParentFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_DRIVE_CLIENTS_FOLDER_ID ausente. Defina no .env.local apontando pra pasta '01 - Clientes' do Shared Drive.",
    );
  }
  return id;
}

function buildFolderName(fullName: string, cpfCnpj: string): string {
  const slug = slugify(fullName, { lower: true, strict: true, locale: "pt" });
  return `${slug}-${cpfCnpj}`;
}

// ----------------------------------------------------------------------------
// CREATE
// ----------------------------------------------------------------------------
export async function createClient(input: ClientCreateOutput) {
  const sb = getSupabaseAdmin();

  // 1) INSERT cliente (cpf_cnpj já vem canônico do Zod transform)
  //    person_type é derivado do tamanho do CPF/CNPJ (11 = PF, 14 = PJ).
  const person_type = input.cpf_cnpj.length === 14 ? "PJ" : "PF";
  const { data: client, error } = await sb
    .from("system_clients")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID, person_type } as ClientInsert)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ClientServiceError(
        "CPF/CNPJ já cadastrado para esta organização",
        "DUPLICATE_CPF",
        409,
      );
    }
    throw new ClientServiceError(error.message, "DB_ERROR", 500);
  }

  // 2) Criar pasta no Drive (best effort — não bloqueia)
  const folderName = buildFolderName(client.full_name, client.cpf_cnpj);
  type DriveFields = {
    drive_folder_id?: string | null;
    drive_folder_url?: string | null;
    drive_sync_failed: boolean;
    drive_sync_error: string | null;
  };
  let driveFields: DriveFields;
  try {
    const folder = await createFolder(folderName, clientsParentFolderId());
    driveFields = {
      drive_folder_id: folder.id,
      drive_folder_url: folder.url,
      drive_sync_failed: false,
      drive_sync_error: null,
    };
  } catch (err) {
    const msg =
      err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
    driveFields = {
      drive_sync_failed: true,
      drive_sync_error: msg.slice(0, 2000),
    };
  }

  const { data: updated, error: updateErr } = await sb
    .from("system_clients")
    .update(driveFields)
    .eq("id", client.id)
    .select()
    .single();

  const finalClient = updated ?? { ...client, ...driveFields };
  if (updateErr) {
    console.error("clients-service: falha ao salvar drive fields:", updateErr.message);
  }

  // 3) Audit log
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG_ID,
    action: "client.create",
    entity_type: "client",
    entity_id: client.id,
    diff: input as unknown as Json,
  });

  return finalClient;
}

// ----------------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------------
export async function updateClient(id: string, input: ClientUpdateOutput) {
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("system_clients")
    .update(input as ClientUpdate)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ClientServiceError(
        "CPF/CNPJ já cadastrado para esta organização",
        "DUPLICATE_CPF",
        409,
      );
    }
    if (error.code === "PGRST116") {
      throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);
    }
    throw new ClientServiceError(error.message, "DB_ERROR", 500);
  }
  if (!data) throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);

  await sb.from("system_audit_log").insert({
    organization_id: data.organization_id,
    action: "client.update",
    entity_type: "client",
    entity_id: data.id,
    diff: input as unknown as Json,
  });

  return data;
}

// ----------------------------------------------------------------------------
// SOFT-DELETE (com cascata em documentos)
// ----------------------------------------------------------------------------
export async function softDeleteClient(id: string) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("system_clients")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw new ClientServiceError(error.message, "DB_ERROR", 500);
  if (!data) throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);

  // Cascata em documentos
  await sb
    .from("system_client_documents")
    .update({ deleted_at: now })
    .eq("client_id", id)
    .is("deleted_at", null);

  await sb.from("system_audit_log").insert({
    organization_id: data.organization_id,
    action: "client.delete",
    entity_type: "client",
    entity_id: data.id,
  });

  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// RE-SYNC DRIVE (chamado quando drive_sync_failed=true e usuário pede retry)
// ----------------------------------------------------------------------------
export async function resyncClientDriveFolder(id: string) {
  const sb = getSupabaseAdmin();

  const { data: client, error } = await sb
    .from("system_clients")
    .select("id, full_name, cpf_cnpj, organization_id, drive_folder_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error || !client) throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);

  if (client.drive_folder_id) {
    return { ok: true as const, alreadySynced: true, folderId: client.drive_folder_id };
  }

  const folderName = buildFolderName(client.full_name, client.cpf_cnpj);
  try {
    const folder = await createFolder(folderName, clientsParentFolderId());
    const { data: updated } = await sb
      .from("system_clients")
      .update({
        drive_folder_id: folder.id,
        drive_folder_url: folder.url,
        drive_sync_failed: false,
        drive_sync_error: null,
      })
      .eq("id", id)
      .select()
      .single();

    await sb.from("system_audit_log").insert({
      organization_id: client.organization_id,
      action: "client.drive_resync",
      entity_type: "client",
      entity_id: id,
      diff: { folder_id: folder.id },
    });

    return { ok: true as const, alreadySynced: false, folder: updated };
  } catch (err) {
    const msg =
      err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
    await sb
      .from("system_clients")
      .update({ drive_sync_failed: true, drive_sync_error: msg.slice(0, 2000) })
      .eq("id", id);
    throw new ClientServiceError(msg, "DB_ERROR", 502);
  }
}

// ----------------------------------------------------------------------------
// READ
// ----------------------------------------------------------------------------
export async function listClients(search?: string) {
  const sb = getSupabaseAdmin();
  const term = search?.trim();

  // Com termo de busca usamos a função SQL, que cobre nome, CPF, e-mail, dados
  // profissionais E os campos customizados (Melhoria 1).
  if (term) {
    const { data, error } = await sb.rpc("system_search_clients", { p_term: term });
    if (error) throw new ClientServiceError(error.message, "DB_ERROR", 500);
    return data ?? [];
  }

  const { data, error } = await sb.from("system_clients_active").select("*").order("full_name");
  if (error) throw new ClientServiceError(error.message, "DB_ERROR", 500);
  return data ?? [];
}

export async function getClient(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("system_clients").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") {
      throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);
    }
    throw new ClientServiceError(error.message, "DB_ERROR", 500);
  }
  return data;
}
