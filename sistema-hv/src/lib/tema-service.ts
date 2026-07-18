// Server-only — CRUD de TEMA e FRENTE (camada B2 do épico R2). Um TEMA é o
// "universo" de um serviço (pipeline op própria, campos, frentes); dentro dele
// vivem as FRENTES (cada uma com pasta/modelos/campos — vínculo em R2-04/R2-03).
// Escreve em system_temas / system_tema_frentes (criadas em R2-01, já aplicadas).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
//
// Molde de CRUD + guarda de exclusão: pipeline-service.ts (createServiceType /
// deleteServiceType:141-225). NÃO toca system_cases / view / trigger (AC-6).

import slugify from "slugify";

import { getSupabaseAdmin } from "./supabase/server";
import type { Database } from "./supabase/types";

type TemaUpdate = Database["public"]["Tables"]["system_temas"]["Update"];
type FrenteUpdate = Database["public"]["Tables"]["system_tema_frentes"]["Update"];

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

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

// ------------------------------------------------------------------- Temas
export async function listTemas() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_temas_active")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw new TemaServiceError(error.message, 500);
  return data ?? [];
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

  // TODO(R2-03): semear a pipeline op inicial do tema (modelo de etapas por tema).
  // AC-4 depende do modelo de etapas por tema — encaixa aqui, espelhando o seeding
  // de createServiceType (pipeline-service.ts:60-109) adaptado ao tema.

  return data;
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
    .select("slug")
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

  // TODO(R2-04): vincular pasta(s) do Drive + modelos por frente
  // (system_service_type_folders ganha `frente_slug` em R2-04). AC-3 depende disso —
  // o CategoryFoldersEditor será reusado passando `frenteSlug` quando a coluna existir.

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
