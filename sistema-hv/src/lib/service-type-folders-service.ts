// Server-only — Pastas do Drive vinculadas a cada TIPO de serviço (categoria).
// kind='caso' → documentos de caso; kind='procuracao' → procurações.
// Cada tipo pode ter VÁRIAS pastas de caso (ex.: FIES ESF) e de procuração.
// Fonte de verdade: system_service_type_folders (migration 20260709000030).

import { createFolder, listFoldersInFolder } from "./google/drive";
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

// T3 (2026-07-19) — espelha a pasta do caso/procuração DENTRO da pasta do tema no
// Drive (organização física pedida pelo owner: `1PtxXw/Tema-X/…`). Resolve a pasta
// do tema via service_type interno (tema_id → system_temas.drive_folder_id) e cria
// uma subpasta com o mesmo nome. BEST-EFFORT: se o tema não tem pasta (T2 não
// rodado) ou o Drive falha, NÃO derruba o vínculo (a fonte de verdade é o banco).
// Chamado só na criação de um vínculo NOVO (não no update idempotente).
async function mirrorFolderIntoTema(
  sb: ReturnType<typeof getSupabaseAdmin>,
  serviceTypeId: string,
  kind: FolderKind,
  folderName: string,
): Promise<void> {
  try {
    const { data: st } = await sb
      .from("system_service_types")
      .select("tema_id")
      .eq("id", serviceTypeId)
      .maybeSingle();
    const temaId = (st as { tema_id?: string | null } | null)?.tema_id;
    if (!temaId) return; // service_type legado (sem tema) — nada a espelhar.

    const { data: tema } = await sb
      .from("system_temas")
      .select("drive_folder_id, drive_casos_folder_id, drive_contratacao_folder_id")
      .eq("id", temaId)
      .maybeSingle();
    const t = tema as {
      drive_folder_id?: string | null;
      drive_casos_folder_id?: string | null;
      drive_contratacao_folder_id?: string | null;
    } | null;
    // Documento de caso → subpasta "Casos"; procuração/contrato → "Contratação".
    // Fallback para a pasta-raiz do tema se a subpasta ainda não existe.
    const target =
      kind === "procuracao"
        ? (t?.drive_contratacao_folder_id ?? t?.drive_folder_id)
        : (t?.drive_casos_folder_id ?? t?.drive_folder_id);
    if (!target) return; // tema ainda sem pasta no Drive.

    await createFolder(folderName, target);
  } catch (err) {
    console.error(
      "service-type-folders: falha ao espelhar a pasta dentro do tema:",
      err instanceof Error ? err.message : err,
    );
  }
}

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

  // T3 — vínculo NOVO criado: espelha a pasta dentro da subpasta certa do tema no
  // Drive (Casos ou Contratação). Best-effort, não derruba o vínculo.
  await mirrorFolderIntoTema(sb, input.serviceTypeId, input.kind, input.name);

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

// T3 — lista as SUBPASTAS existentes na raiz de "modelos" (kind='caso') ou
// "procuração" (kind='procuracao'), para o admin escolher qual VINCULAR a um tema.
// São os "casos"/procurações que o dono já organizou no Drive. N:N: a mesma pasta
// pode ser vinculada a vários temas (cada vínculo é uma linha em
// system_service_type_folders com o service_type interno do tema).
export async function listRootModelFolders(
  kind: FolderKind,
): Promise<{ id: string; name: string; url: string }[]> {
  const parent = kind === "procuracao" ? PROCURACAO_ROOT_FOLDER_ID : MODELS_ROOT_FOLDER_ID;
  return listFoldersInFolder(parent);
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
