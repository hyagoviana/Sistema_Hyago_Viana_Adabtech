// Server-only — Pastas do Drive vinculadas a cada TIPO de serviço (categoria).
// kind='caso' → documentos de caso; kind='procuracao' → procurações.
// Cada tipo pode ter VÁRIAS pastas de caso (ex.: FIES ESF) e de procuração.
// Fonte de verdade: system_service_type_folders (migration 20260709000030).

import { createFolder } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

// Pastas-raiz onde as pastas NOVAS são criadas (owner, 2026-07-09):
//   caso       → "07- Modelos"
//   procuracao → "08- Contratos e procurações"
const MODELS_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_MODELS_ROOT_FOLDER_ID?.trim() || "1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ";
const PROCURACAO_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_PROCURACAO_FOLDER_ID?.trim() || "1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd";

export type FolderKind = "caso" | "procuracao";

export class ServiceTypeFoldersError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ServiceTypeFoldersError";
  }
}

export type ServiceTypeFolder = {
  id: string;
  service_type_id: string;
  kind: FolderKind;
  drive_folder_id: string;
  name: string;
  ordem: number;
};

// Lista as pastas de uma categoria (opcionalmente filtrando por kind).
export async function listTypeFolders(
  serviceTypeId: string,
  kind?: FolderKind,
): Promise<ServiceTypeFolder[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_service_type_folders_active")
    .select("id, service_type_id, kind, drive_folder_id, name, ordem")
    .eq("service_type_id", serviceTypeId)
    .order("kind", { ascending: true })
    .order("ordem", { ascending: true });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw new ServiceTypeFoldersError(error.message, 500);
  return (data ?? []) as ServiceTypeFolder[];
}

// Retorna só os IDs de pasta do Drive de uma categoria+kind (para filtrar modelos).
export async function listTypeFolderIds(
  serviceTypeId: string,
  kind: FolderKind,
): Promise<string[]> {
  const rows = await listTypeFolders(serviceTypeId, kind);
  return rows.map((r) => r.drive_folder_id);
}

// Vincula uma pasta EXISTENTE (id do Drive) à categoria. Idempotente por UNIQUE.
export async function linkExistingFolder(input: {
  serviceTypeId: string;
  kind: FolderKind;
  driveFolderId: string;
  name: string;
}): Promise<ServiceTypeFolder> {
  const sb = getSupabaseAdmin();
  const existing = await listTypeFolders(input.serviceTypeId, input.kind);
  const ordem = existing.length;
  const { data, error } = await sb
    .from("system_service_type_folders")
    .upsert(
      {
        organization_id: DEFAULT_ORG,
        service_type_id: input.serviceTypeId,
        kind: input.kind,
        drive_folder_id: input.driveFolderId,
        name: input.name,
        ordem,
      },
      { onConflict: "service_type_id,kind,drive_folder_id", ignoreDuplicates: false },
    )
    .select("id, service_type_id, kind, drive_folder_id, name, ordem")
    .single();
  if (error || !data)
    throw new ServiceTypeFoldersError(error?.message ?? "Falha ao vincular pasta", 500);
  return data as ServiceTypeFolder;
}

// Cria uma pasta NOVA no Drive (sob a raiz correta por kind) e a vincula à categoria.
export async function createAndLinkFolder(input: {
  serviceTypeId: string;
  kind: FolderKind;
  name: string;
}): Promise<ServiceTypeFolder> {
  const name = input.name.trim();
  if (!name) throw new ServiceTypeFoldersError("Informe o nome da pasta", 422);
  const parent = input.kind === "procuracao" ? PROCURACAO_ROOT_FOLDER_ID : MODELS_ROOT_FOLDER_ID;
  const folder = await createFolder(name, parent);
  return linkExistingFolder({
    serviceTypeId: input.serviceTypeId,
    kind: input.kind,
    driveFolderId: folder.id,
    name: folder.name,
  });
}

// Desvincula (soft-delete) uma pasta da categoria. NÃO apaga a pasta no Drive.
export async function unlinkFolder(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_service_type_folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new ServiceTypeFoldersError(error.message, 500);
  return { ok: true as const, id };
}
