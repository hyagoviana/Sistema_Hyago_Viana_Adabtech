// Server-only — CRUD de TEMA e FRENTE (camada B2 do épico R2). Um TEMA é o
// "universo" de um serviço (pipeline op própria, campos, frentes); dentro dele
// vivem as FRENTES (cada uma com pasta/modelos/campos — vínculo em R2-04/R2-03).
// Escreve em system_temas / system_tema_frentes (criadas em R2-01, já aplicadas).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
//
// Molde de CRUD + guarda de exclusão: pipeline-service.ts (createServiceType /
// deleteServiceType:141-225). NÃO toca system_cases / view / trigger (AC-6).
//
// R2-03 (Opção 1 — service_type interno espelho 1:1): createTema/deleteTema agora
// criam/soft-deletam um system_service_type INTERNO (o "motor") vinculado por
// tema_id, reusando createServiceType/deleteServiceType. COEXISTÊNCIA: a tela legada
// "Nova categoria" (cria service_type solto, sem tema_id) e "Temas" (cria
// service_type interno) convivem — a unificação da UI é refinamento futuro
// (R2-05/R2-06); NÃO unificar aqui.

import slugify from "slugify";

import {
  createFolder,
  deleteFile,
  getFileMeta,
  listFoldersInFolder,
  renameFolder,
} from "./google/drive";
import { createServiceType, deleteServiceType } from "./pipeline-service";
import { getSupabaseAdmin } from "./supabase/server";
import type { Database } from "./supabase/types";

type TemaUpdate = Database["public"]["Tables"]["system_temas"]["Update"];
type FrenteUpdate = Database["public"]["Tables"]["system_tema_frentes"]["Update"];

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

// T2 (2026-07-19) — pasta-raiz de TODOS os temas no Drive (a pasta "tema"). Cada
// tema cria a sua subpasta aqui, com o nome do tema. Configurável por env; o
// default é a pasta que o dono indicou. A Service Account precisa ter acesso de
// Editor a esta pasta para criar as subpastas.
const TEMAS_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_TEMAS_ROOT_FOLDER_ID?.trim() || "1PtxXwOMn0ibNRXyzAQN-79mHUJc8w4Ro";

// Nomes fixos das subpastas dentro da pasta de cada tema (owner, 2026-07-19).
// "Casos" = documentos de caso; "Procurações" = documentos de assinatura (→ ZapSign).
const SUB_CASOS = "Casos";
const SUB_PROCURACOES = "Procurações";

// Garante as subpastas "Casos" e "Contratação" dentro da pasta do tema (idempotente:
// reaproveita as que já existem por nome, cria as que faltam). Best-effort — devolve
// null nos ids se o Drive falhar (o tema continua utilizável).
async function ensureTemaSubfolders(
  temaFolderId: string,
): Promise<{ casosId: string | null; contratacaoId: string | null }> {
  let existing: { id: string; name: string }[];
  try {
    existing = await listFoldersInFolder(temaFolderId);
  } catch (err) {
    console.error(
      "tema-service: falha ao listar subpastas do tema:",
      err instanceof Error ? err.message : err,
    );
    return { casosId: null, contratacaoId: null };
  }
  const byName = new Map(existing.map((f) => [f.name.trim().toLowerCase(), f.id]));
  // Resolve cada subpasta de forma INDEPENDENTE: se criar uma falhar, a outra não
  // é perdida (evita partial-write que descartaria o id já resolvido).
  const resolve = async (name: string): Promise<string | null> => {
    const found = byName.get(name.toLowerCase());
    if (found) return found;
    try {
      return (await createFolder(name, temaFolderId)).id;
    } catch (err) {
      console.error(
        `tema-service: falha ao criar subpasta "${name}":`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  };
  return {
    casosId: await resolve(SUB_CASOS),
    contratacaoId: await resolve(SUB_PROCURACOES),
  };
}

// Lista as pastas dentro da raiz "tema" (1PtxXw) — para o admin ESCOLHER qual pasta
// é a de um tema (vincular pasta que ele já criou no Drive).
export async function listTemasRootFolders() {
  return listFoldersInFolder(TEMAS_ROOT_FOLDER_ID);
}

export class TemaServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TemaServiceError";
  }
}

// Slug canônico (MAIÚSCULO, A-Z0-9_) — mesmo formato do slugifyCat da UI de
// categoria (pipeline.tsx:39). Derivado do nome quando não informado.
function toSlug(s: string): string {
  return (
    slugify(s, { strict: true, locale: "pt" })
      .toUpperCase()
      .replace(/-/g, "_")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "TEMA"
  );
}

// Deriva um slug de service_type ÚNICO a partir de `base`, com GUARDA DE COLISÃO
// (§6/R-3 do design R2-03). system_service_types tem UNIQUE(organization_id, slug)
// entre linhas ativas — criar o service_type interno de um tema "COVID" quando já
// existe um service_type legado "COVID" estouraria um 500 opaco. Estratégia: se o
// slug `base` já está ocupado por um service_type ATIVO, sufixamos (`_T`, `_T2`…)
// até achar um livre — NUNCA reutilizamos o legado (o motor precisa de um
// service_type próprio do tema, com o conjunto de etapas espelho recém-semeado).
async function uniqueServiceTypeSlug(
  sb: ReturnType<typeof getSupabaseAdmin>,
  base: string,
): Promise<string> {
  const taken = async (slug: string) => {
    // A UNIQUE(organization_id, slug) de system_service_types é FULL (não parcial):
    // um slug de service_type soft-deletado (deleted_at != null) AINDA ocupa o índice
    // e colidiria no INSERT. Por isso NÃO filtramos deleted_at aqui — consideramos
    // ativos E soft-deletados como "tomados".
    const { data } = await sb
      .from("system_service_types")
      .select("id")
      .eq("organization_id", DEFAULT_ORG)
      .eq("slug", slug)
      .maybeSingle();
    return !!data;
  };

  if (!(await taken(base))) return base;
  // Sufixa mantendo o teto de 40 chars do toSlug.
  for (let i = 1; i < 100; i++) {
    const suffix = i === 1 ? "_T" : `_T${i}`;
    const candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }
  // Fallback improvável: sufixo por timestamp (sempre único).
  return `${base.slice(0, 30)}_T${Date.now().toString(36)}`;
}

// Puxa o service_type INTERNO (motor) de um tema — o vínculo é
// system_service_types.tema_id = tema.id (Opção 1, 1:1). Usado pela camada de
// casos/Kanban (R2-05) para resolver o service_type_id a partir do tema.
export async function getTemaServiceType(temaId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_service_types")
    .select("*")
    .eq("tema_id", temaId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

// ------------------------------------------------------------------- Temas
export async function listTemas() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_temas_active")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw new TemaServiceError(error.message, 500);
  const temas = data ?? [];
  if (temas.length === 0) return temas;

  // T1 (2026-07-19) — resolve o service_type INTERNO (motor) de cada tema, para o
  // seletor do Kanban abrir a esteira certa a partir do tema (sem N queries no
  // clique). Campo ADITIVO: consumidores que só usam id/name/slug seguem intactos.
  const { data: sts } = await sb
    .from("system_service_types")
    .select("id, tema_id")
    .not("tema_id", "is", null)
    .is("deleted_at", null);
  const stByTema = new Map<string, string>();
  for (const s of sts ?? []) {
    if (s.tema_id) stByTema.set(s.tema_id, s.id);
  }
  return temas.map((t) => ({ ...t, service_type_id: stByTema.get(t.id) ?? null }));
}

export async function createTema(input: { name: string; slug?: string; ordem?: number }) {
  const name = input.name.trim();
  if (!name) throw new TemaServiceError("Nome do tema é obrigatório", 422);
  const slug = (input.slug?.trim() ? toSlug(input.slug) : toSlug(name)) || "TEMA";

  const sb = getSupabaseAdmin();

  // Idempotência de slug: UNIQUE(organization_id, slug). Se já existe um tema ATIVO
  // com o mesmo slug, recusa (409) em vez de estourar 500 opaco do banco.
  const { data: existing } = await sb
    .from("system_temas_active")
    .select("id")
    .eq("organization_id", DEFAULT_ORG)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    throw new TemaServiceError("Já existe um tema com esse nome/slug.", 409);
  }

  const { data, error } = await sb
    .from("system_temas")
    .insert({
      organization_id: DEFAULT_ORG,
      name,
      slug,
      ordem: input.ordem ?? 0,
    })
    .select()
    .single();
  if (error || !data) throw new TemaServiceError(error?.message ?? "Falha ao criar tema", 500);

  // R2-03 (Opção 1 — service_type interno espelho 1:1). O motor inteiro (trigger
  // system_fn_sync_stage_ids, checklist, useStages, moveCase*) resolve por
  // service_type_id — um TEMA não é service_type. Então criamos TAMBÉM um
  // system_service_type INTERNO vinculado (service_type.tema_id = tema.id), que
  // já nasce com o conjunto completo de etapas op/fin/comercial via createServiceType
  // (pipeline-service.ts). O tema é a "cara" (UX/agrupamento); o service_type interno
  // é o motor. Casos rodam por service_type_id exatamente como hoje.
  //
  // R-3 (guarda de colisão de slug): o slug do service_type interno é derivado do
  // MESMO nome do tema; se já existir um service_type ativo com esse slug (ex.: tema
  // "COVID" vs service_type legado COVID), sufixamos (_T, _T2…) para não estourar a
  // UNIQUE(organization_id, slug). O slug do TEMA (tabela system_temas) é independente.
  //
  // R-1 (atomicidade): sem transação multi-statement no supabase-js; se o seeding do
  // service_type falhar, COMPENSAMOS soft-deletando o tema recém-criado (+ tombstone
  // do slug) para não deixar um tema órfão sem pipeline (que não aceitaria casos).
  let createdServiceTypeId: string | null = null;
  try {
    const stSlug = await uniqueServiceTypeSlug(sb, slug);
    const serviceType = await createServiceType({
      name,
      slug: stSlug,
      ordem: input.ordem ?? 0,
    });
    createdServiceTypeId = serviceType.id;
    // Vincula o service_type interno ao tema (Opção 1, 1:1).
    const { error: linkErr } = await sb
      .from("system_service_types")
      .update({ tema_id: data.id })
      .eq("id", serviceType.id);
    if (linkErr) throw new TemaServiceError(linkErr.message, 500);
  } catch (seedErr) {
    // Se o service_type interno já foi criado mas o vínculo (ou o restante) falhou,
    // ele ficaria ATIVO e ÓRFÃO (sem tema). Soft-deletamos direto (sem passar por
    // deleteServiceType, que traz guarda de casos + poderia mascarar o erro real com
    // um 409). O service_type recém-criado ainda não tem casos, então é seguro.
    if (createdServiceTypeId) {
      await sb
        .from("system_service_types")
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq("id", createdServiceTypeId);
    }
    // Compensação: reverte o tema para não ficar órfão sem motor.
    await sb
      .from("system_temas")
      .update({
        deleted_at: new Date().toISOString(),
        active: false,
        slug: `${slug}__del_${Date.now().toString(36)}`,
      })
      .eq("id", data.id);
    const msg = seedErr instanceof Error ? seedErr.message : "Falha ao semear a pipeline do tema";
    throw new TemaServiceError(`Falha ao criar a pipeline do tema: ${msg}`, 500);
  }

  // T2 — cria a pasta-raiz do tema no Drive (dentro da pasta "tema"). BEST-EFFORT:
  // se a Service Account não tiver acesso à pasta pai, o tema fica sem pasta e o
  // admin cria depois pelo botão "Criar pasta do tema" (ensureTemaFolder). Não
  // derruba a criação do tema (que já tem o motor/pipeline).
  try {
    const folder = await createFolder(name, TEMAS_ROOT_FOLDER_ID);
    const subs = await ensureTemaSubfolders(folder.id);
    const { data: withFolder } = await sb
      .from("system_temas")
      .update({
        drive_folder_id: folder.id,
        drive_folder_url: folder.url,
        drive_casos_folder_id: subs.casosId,
        drive_contratacao_folder_id: subs.contratacaoId,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (withFolder) return withFolder;
  } catch (folderErr) {
    console.error(
      "tema-service: falha ao criar pasta do tema no Drive:",
      folderErr instanceof Error ? folderErr.message : folderErr,
    );
  }

  return data;
}

// T-Drive — vincula ao tema uma pasta que o admin JÁ criou no Drive (escolhida na
// UI dentre as subpastas de 1PtxXw). Garante as subpastas Casos/Contratação e grava
// os ids. Usado quando o owner prefere apontar para a pasta que ele mesmo criou.
export async function linkTemaFolder(temaId: string, driveFolderId: string) {
  const sb = getSupabaseAdmin();
  const { data: tema } = await sb
    .from("system_temas_active")
    .select("id")
    .eq("id", temaId)
    .maybeSingle();
  if (!tema) throw new TemaServiceError("Tema não encontrado", 404);

  const meta = await getFileMeta(driveFolderId).catch(() => null);
  const url = (meta as { webViewLink?: string | null } | null)?.webViewLink ?? null;
  const subs = await ensureTemaSubfolders(driveFolderId);

  const { error } = await sb
    .from("system_temas")
    .update({
      drive_folder_id: driveFolderId,
      drive_folder_url: url,
      drive_casos_folder_id: subs.casosId,
      drive_contratacao_folder_id: subs.contratacaoId,
    })
    .eq("id", temaId);
  if (error) throw new TemaServiceError(error.message, 500);
  return { id: driveFolderId, url };
}

// T2 — garante a pasta-raiz do tema no Drive + as subpastas Casos/Contratação
// (idempotente). Se a pasta já existe, NÃO recria a raiz, mas AINDA garante as
// subpastas (para os temas criados antes das subpastas existirem).
export async function ensureTemaFolder(temaId: string) {
  const sb = getSupabaseAdmin();
  const { data: tema, error } = await sb
    .from("system_temas_active")
    .select("*")
    .eq("id", temaId)
    .maybeSingle();
  if (error || !tema) throw new TemaServiceError("Tema não encontrado", 404);

  let folderId = (tema as { drive_folder_id?: string | null }).drive_folder_id ?? null;
  let folderUrl = (tema as { drive_folder_url?: string | null }).drive_folder_url ?? null;
  let created = false;
  if (!folderId) {
    const folder = await createFolder(tema.name, TEMAS_ROOT_FOLDER_ID);
    folderId = folder.id;
    folderUrl = folder.url;
    created = true;
  }

  const subs = await ensureTemaSubfolders(folderId);
  const { error: upErr } = await sb
    .from("system_temas")
    .update({
      drive_folder_id: folderId,
      drive_folder_url: folderUrl,
      drive_casos_folder_id: subs.casosId,
      drive_contratacao_folder_id: subs.contratacaoId,
    })
    .eq("id", temaId);
  if (upErr) throw new TemaServiceError(upErr.message, 500);
  return { id: folderId, url: folderUrl, created };
}

export async function updateTema(
  id: string,
  patch: Partial<{ name: string; ordem: number; active: boolean }>,
) {
  const sb = getSupabaseAdmin();
  const clean: TemaUpdate = {};
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;
  if (patch.active !== undefined) clean.active = patch.active;

  const { data, error } = await sb
    .from("system_temas")
    .update(clean)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new TemaServiceError(error?.message ?? "Falha ao atualizar tema", 500);

  // Ajuste A10 (2026-07-20, Adavio) — ao renomear o TEMA, renomeia TAMBÉM o
  // service_type INTERNO espelho (Opção 1), que carrega o `name` usado em vários
  // rótulos (fallback do getCaseTemaLabel, seletor de categoria, etc.). Sem isso o
  // nome ANTIGO do tema aparecia no topo do caso. Best-effort (não derruba o rename).
  if (patch.name !== undefined && clean.name) {
    // O supabase-js resolve com `{ error }` (não lança) — checar o erro retornado.
    const { error: stErr } = await sb
      .from("system_service_types")
      .update({ name: clean.name })
      .eq("tema_id", id)
      .is("deleted_at", null);
    if (stErr) {
      console.error(
        "tema-service: falha ao renomear o service_type interno do tema:",
        stErr.message,
      );
    }
  }

  // T2 — mantém a pasta do tema no Drive com o nome atual (best-effort). Não
  // derruba o rename se o Drive falhar.
  if (patch.name !== undefined && clean.name) {
    const folderId = (data as { drive_folder_id?: string | null }).drive_folder_id;
    if (folderId) {
      try {
        await renameFolder(folderId, clean.name);
      } catch (folderErr) {
        console.error(
          "tema-service: falha ao renomear a pasta do tema no Drive:",
          folderErr instanceof Error ? folderErr.message : folderErr,
        );
      }
    }
  }
  return data;
}

// EXCLUI um tema. GUARDA (molde deleteServiceType:156-167): não exclui se houver
// system_cases com tema_id vinculado. Soft-delete do tema e das suas frentes;
// tombstone do slug para liberar o nome (UNIQUE(organization_id, slug)).
export async function deleteTema(id: string) {
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: tema } = await sb
    .from("system_temas")
    .select("slug, drive_folder_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!tema) throw new TemaServiceError("Tema não encontrado", 404);

  // GUARDA: nenhum caso vinculado a este tema (system_cases.tema_id).
  const { count } = await sb
    .from("system_cases")
    .select("id", { count: "exact", head: true })
    .eq("tema_id", id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new TemaServiceError(
      "Não é possível excluir: há casos vinculados a este tema. Remaneje-os antes.",
      409,
    );
  }

  // R2-03 (Opção 1) — o tema tem um service_type INTERNO (motor) vinculado por
  // tema_id. Ao excluir o tema, soft-deletamos também esse service_type reusando
  // deleteServiceType, que já traz a MESMA guarda de casos (por service_type_id OU
  // case_type=slug → 409) e cascata de etapas/pastas/modelos. Isso cobre o alerta do
  // arquiteto (R2-06): casos podem chegar via service_type_id do motor, não só via
  // tema_id — deleteServiceType captura esse caminho e recusa a exclusão se houver.
  const serviceType = await getTemaServiceType(id);
  if (serviceType) {
    await deleteServiceType(serviceType.id); // propaga 409 se houver casos no motor
  }

  // Soft-delete das frentes do tema e depois do tema. Tombstone do slug para
  // liberar o nome (a UNIQUE prende o slug mesmo após soft-delete).
  await sb.from("system_tema_frentes").update({ deleted_at: nowIso }).eq("tema_id", id);
  await sb
    .from("system_temas")
    .update({
      deleted_at: nowIso,
      active: false,
      slug: `${tema.slug}__del_${Date.now().toString(36)}`,
    })
    .eq("id", id);

  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "tema.deleted",
    entity_type: "tema",
    entity_id: id,
  });

  // Owner (2026-07-19) — excluir o tema exclui a pasta dele no Drive (vai para a
  // lixeira; leva junto as subpastas Casos/Procurações). Best-effort: se o Drive
  // falhar, o tema já foi soft-deletado no banco (não reverte).
  const folderId = (tema as { drive_folder_id?: string | null }).drive_folder_id;
  if (folderId) {
    try {
      await deleteFile(folderId);
    } catch (err) {
      console.error(
        "tema-service: falha ao excluir a pasta do tema no Drive:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { ok: true as const, id };
}

// ------------------------------------------------------------------- Frentes
export async function listFrentes(temaId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_tema_frentes_active")
    .select("*")
    .eq("tema_id", temaId)
    .order("ordem", { ascending: true });
  if (error) throw new TemaServiceError(error.message, 500);
  return data ?? [];
}

export async function createFrente(input: {
  temaId: string;
  label: string;
  slug?: string;
  ordem?: number;
}) {
  const label = input.label.trim();
  if (!label) throw new TemaServiceError("Rótulo da frente é obrigatório", 422);
  const slug = (input.slug?.trim() ? toSlug(input.slug) : toSlug(label)) || "FRENTE";

  const sb = getSupabaseAdmin();

  // O tema precisa existir (e estar ativo) para pendurar uma frente.
  const { data: tema } = await sb
    .from("system_temas_active")
    .select("id")
    .eq("id", input.temaId)
    .maybeSingle();
  if (!tema) throw new TemaServiceError("Tema não encontrado", 404);

  // Idempotência de slug: UNIQUE(organization_id, tema_id, slug) — recusa duplicado
  // ATIVO no mesmo tema com 409 legível.
  const { data: existing } = await sb
    .from("system_tema_frentes_active")
    .select("id")
    .eq("organization_id", DEFAULT_ORG)
    .eq("tema_id", input.temaId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    throw new TemaServiceError("Já existe uma frente com esse nome/slug neste tema.", 409);
  }

  const { data, error } = await sb
    .from("system_tema_frentes")
    .insert({
      organization_id: DEFAULT_ORG,
      tema_id: input.temaId,
      slug,
      label,
      ordem: input.ordem ?? 0,
    })
    .select()
    .single();
  if (error || !data) throw new TemaServiceError(error?.message ?? "Falha ao criar frente", 500);

  // Vínculo de pasta/modelos por frente (R2-04): feito na UI do editor de tema
  // (CategoryFoldersEditor reusado com `frenteSlug`), gravando `frente_slug` em
  // system_service_type_folders — não no ato de criar a frente.

  return data;
}

export async function updateFrente(
  id: string,
  patch: Partial<{ label: string; ordem: number; active: boolean }>,
) {
  const sb = getSupabaseAdmin();
  const clean: FrenteUpdate = {};
  if (patch.label !== undefined) clean.label = patch.label.trim();
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;
  if (patch.active !== undefined) clean.active = patch.active;

  const { data, error } = await sb
    .from("system_tema_frentes")
    .update(clean)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new TemaServiceError(error?.message ?? "Falha ao atualizar frente", 500);
  return data;
}

// EXCLUI uma frente. GUARDA: não exclui se houver system_cases com frente_slug
// vinculado (dentro do tema da frente). Soft-delete.
export async function deleteFrente(id: string) {
  const sb = getSupabaseAdmin();

  const { data: frente } = await sb
    .from("system_tema_frentes")
    .select("slug, tema_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!frente) throw new TemaServiceError("Frente não encontrada", 404);

  // GUARDA: nenhum caso do tema usando esta frente (system_cases.frente_slug). O
  // frente_slug é único DENTRO do tema, então casamos tema_id + frente_slug.
  const { count } = await sb
    .from("system_cases")
    .select("id", { count: "exact", head: true })
    .eq("tema_id", frente.tema_id)
    .eq("frente_slug", frente.slug)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new TemaServiceError(
      "Não é possível excluir: há casos vinculados a esta frente. Remaneje-os antes.",
      409,
    );
  }

  const { error } = await sb
    .from("system_tema_frentes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new TemaServiceError(error.message, 500);

  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "tema_frente.deleted",
    entity_type: "tema_frente",
    entity_id: id,
  });

  return { ok: true as const, id };
}
