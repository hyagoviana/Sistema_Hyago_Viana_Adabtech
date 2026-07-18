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
  frente_slug: string | null;
};

// (R2-04) Lista as pastas de uma categoria (opcionalmente filtrando por kind).
// `frenteSlug` (opcional):
//   • undefined → gestão/admin: devolve TODAS as pastas (comuns + de todas as
//     frentes) — usado pelo editor de vínculo de pastas.
//   • string    → resolução por caso de uma frente: pastas dessa frente OU comuns
//     (frente_slug IS NULL). NUNCA esconde as pastas comuns do tema.
//   • null      → caso SEM frente: só as pastas comuns (frente_slug IS NULL). O
//     fallback por case_type (nos modelos) preserva os casos legados.
export async function listTypeFolders(
  serviceTypeId: string,
  kind?: FolderKind,
  frenteSlug?: string | null,
): Promise<ServiceTypeFolder[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_service_type_folders_active")
    .select("id, service_type_id, kind, drive_folder_id, name, ordem, frente_slug")
    .eq("service_type_id", serviceTypeId)
    .order("kind", { ascending: true })
    .order("ordem", { ascending: true });
  if (kind) q = q.eq("kind", kind);
  // frenteSlug informado (mesmo null) → filtra por frente + comuns. undefined
  // (parâmetro omitido) → sem filtro de frente (gestão vê tudo).
  if (frenteSlug !== undefined) {
    q =
      frenteSlug === null
        ? q.is("frente_slug", null)
        : q.or(`frente_slug.eq.${frenteSlug},frente_slug.is.null`);
  }
  const { data, error } = await q;
  if (error) throw new ServiceTypeFoldersError(error.message, 500);
  return (data ?? []) as ServiceTypeFolder[];
}

// Retorna só os IDs de pasta do Drive de uma categoria+kind (para filtrar modelos).
export async function listTypeFolderIds(
  serviceTypeId: string,
  kind: FolderKind,
  frenteSlug?: string | null,
): Promise<string[]> {
  const rows = await listTypeFolders(serviceTypeId, kind, frenteSlug);
  return rows.map((r) => r.drive_folder_id);
}

// Vincula uma pasta EXISTENTE (id do Drive) à categoria. Idempotente por UNIQUE.
// `frenteSlug` (R2-04): NULL/omisso = vale para todo o tema; setado = só a frente.
// O UNIQUE (service_type_id, kind, drive_folder_id, COALESCE(frente_slug,'')) permite
// a MESMA pasta vinculada ao tema todo E a uma frente específica (linhas distintas).
export async function linkExistingFolder(input: {
  serviceTypeId: string;
  kind: FolderKind;
  driveFolderId: string;
  name: string;
  frenteSlug?: string | null;
}): Promise<ServiceTypeFolder> {
  const sb = getSupabaseAdmin();
  const frenteSlug = input.frenteSlug ?? null;
  const cols = "id, service_type_id, kind, drive_folder_id, name, ordem, frente_slug";

  // Idempotência manual: o UNIQUE parcial usa COALESCE(frente_slug,''), uma
  // EXPRESSÃO — o ON CONFLICT do PostgREST (upsert) só casa lista de colunas
  // literais, não expressão. Então checamos o vínculo ativo do mesmo escopo
  // (service_type_id + kind + drive_folder_id + frente) e atualizamos o nome, ou
  // inserimos. Igual à semântica anterior do upsert (ignoreDuplicates:false).
  let dup = sb
    .from("system_service_type_folders")
    .select("id")
    .eq("service_type_id", input.serviceTypeId)
    .eq("kind", input.kind)
    .eq("drive_folder_id", input.driveFolderId)
    .is("deleted_at", null);
  dup = frenteSlug === null ? dup.is("frente_slug", null) : dup.eq("frente_slug", frenteSlug);
  const { data: existingLink } = await dup.maybeSingle();

  if (existingLink) {
    const { data, error } = await sb
      .from("system_service_type_folders")
      .update({ name: input.name })
      .eq("id", (existingLink as { id: string }).id)
      .select(cols)
      .single();
    if (error || !data)
      throw new ServiceTypeFoldersError(error?.message ?? "Falha ao vincular pasta", 500);
    return data as ServiceTypeFolder;
  }

  // ordem = nº de pastas já vinculadas ao MESMO escopo (kind + frente).
  const existing = await listTypeFolders(input.serviceTypeId, input.kind, frenteSlug);
  const ordem = existing.length;
  const { data, error } = await sb
    .from("system_service_type_folders")
    .insert({
      organization_id: DEFAULT_ORG,
      service_type_id: input.serviceTypeId,
      kind: input.kind,
      drive_folder_id: input.driveFolderId,
      name: input.name,
      ordem,
      frente_slug: frenteSlug,
    })
    .select(cols)
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
  frenteSlug?: string | null;
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
    frenteSlug: input.frenteSlug ?? null,
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
