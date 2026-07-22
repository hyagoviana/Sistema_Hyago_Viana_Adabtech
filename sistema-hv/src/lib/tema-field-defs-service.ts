// Server-only — CRUD das DEFINIÇÕES de campo personalizado por TEMA/FRENTE
// (R2-07, camada B2 do épico R2). Estrutura GENÉRICA: define QUAIS campos
// aparecem na ficha do caso por tema (frente NULL = painel padrão) e por frente
// (frente_slug setado = condicional). O VALOR por caso continua em
// system_cases.canonical_fields (S2-07) — este serviço NÃO grava valor, só defs.
// Escreve em system_tema_field_defs (criada em R2-07, migration 20260719000006).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
//
// Molde: tema-service.ts (CRUD + slug), client-field-defs (defs + key/label/type).
// NÃO migra os campos FIES (R5-06 / fies-fields.ts) para cá — só a estrutura
// genérica. FiesFields continua funcionando por conta própria.

import slugify from "slugify";

import { getSupabaseAdmin } from "./supabase/server";
import type { Database } from "./supabase/types";

type FieldDefRow = Database["public"]["Tables"]["system_tema_field_defs"]["Row"];
type FieldDefUpdate = Database["public"]["Tables"]["system_tema_field_defs"]["Update"];

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export const TEMA_FIELD_TYPES = [
  "text",
  "select",
  "multiselect",
  "money",
  "number",
  "date",
  "boolean",
] as const;
export type TemaFieldType = (typeof TEMA_FIELD_TYPES)[number];

export class TemaFieldDefServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TemaFieldDefServiceError";
  }
}

// Slug canônico da chave (minúsculo, a-z0-9_) — chave estável no JSONB
// canonical_fields. Derivado do label quando não informado. Evita colisão com o
// domínio fechado FIES (fies_*) prefixando com "campo_" se necessário não é
// preciso — a UNIQUE é por tema/frente; o operador escolhe a chave.
function toKey(s: string): string {
  return (
    slugify(s, { strict: true, locale: "pt" })
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "campo"
  );
}

// Normaliza `options` (para type='select'/'multiselect'): aceita array de
// strings; descarta vazios; retorna null se não usar opções ou lista vazia.
function normalizeOptions(type: string, options: unknown): string[] | null {
  if (type !== "select" && type !== "multiselect") return null;
  if (!Array.isArray(options)) return null;
  const clean = options
    .map((o) => (typeof o === "string" ? o.trim() : ""))
    .filter((o) => o.length > 0);
  return clean.length > 0 ? clean : null;
}

// Lê as defs aplicáveis a um caso: as do TEMA (frente NULL, painel padrão) MAIS
// as da FRENTE do caso (quando houver frenteSlug). Ordena por (frente NULL antes)
// e `ordem`. Retorna [] se o tema não tem defs. NÃO usa RLS (service_role); o
// gate de leitura é apenas requireAuth (defs não são sensíveis).
export async function listTemaFieldDefs(
  temaId: string,
  frenteSlug?: string | null,
): Promise<FieldDefRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_tema_field_defs_active")
    .select("*")
    .eq("tema_id", temaId)
    .eq("active", true);
  // Def padrão do tema (frente NULL) sempre; def da frente do caso quando houver.
  q = frenteSlug
    ? q.or(`frente_slug.is.null,frente_slug.eq.${frenteSlug}`)
    : q.is("frente_slug", null);
  const { data, error } = await q.order("ordem", { ascending: true });
  if (error) throw new TemaFieldDefServiceError(error.message, 500);
  // Ordena padrão-do-tema (NULL) antes das condicionais da frente, depois por ordem.
  return (data ?? []).slice().sort((a, b) => {
    const af = a.frente_slug ? 1 : 0;
    const bf = b.frente_slug ? 1 : 0;
    if (af !== bf) return af - bf;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
}

// Lista TODAS as defs de um tema para a UI admin (padrão do tema + de cada
// frente). `frenteSlug === undefined` = todas; `null` = só padrão do tema;
// string = só daquela frente.
export async function listTemaFieldDefsAdmin(
  temaId: string,
  frenteSlug?: string | null,
): Promise<FieldDefRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("system_tema_field_defs_active").select("*").eq("tema_id", temaId);
  if (frenteSlug === null) q = q.is("frente_slug", null);
  else if (typeof frenteSlug === "string") q = q.eq("frente_slug", frenteSlug);
  const { data, error } = await q.order("ordem", { ascending: true });
  if (error) throw new TemaFieldDefServiceError(error.message, 500);
  return data ?? [];
}

export async function createTemaFieldDef(input: {
  temaId: string;
  frenteSlug?: string | null;
  key?: string;
  label: string;
  type: string;
  options?: unknown;
  ordem?: number;
  required?: boolean;
}): Promise<FieldDefRow> {
  const label = input.label.trim();
  if (!label) throw new TemaFieldDefServiceError("Rótulo do campo é obrigatório", 422);
  if (!TEMA_FIELD_TYPES.includes(input.type as TemaFieldType)) {
    throw new TemaFieldDefServiceError("Tipo de campo inválido", 422);
  }
  const key = (input.key?.trim() ? toKey(input.key) : toKey(label)) || "campo";
  const frenteSlug = input.frenteSlug?.trim() ? input.frenteSlug.trim() : null;

  const sb = getSupabaseAdmin();

  // O tema precisa existir (e estar ativo).
  const { data: tema } = await sb
    .from("system_temas_active")
    .select("id")
    .eq("id", input.temaId)
    .maybeSingle();
  if (!tema) throw new TemaFieldDefServiceError("Tema não encontrado", 404);

  // Idempotência de key: UNIQUE(tema_id, COALESCE(frente_slug,''), key) entre
  // ativos — recusa duplicado com 409 legível em vez de estourar 500 do banco.
  const dup = sb
    .from("system_tema_field_defs_active")
    .select("id")
    .eq("tema_id", input.temaId)
    .eq("key", key);
  const { data: existing } = await (
    frenteSlug ? dup.eq("frente_slug", frenteSlug) : dup.is("frente_slug", null)
  ).maybeSingle();
  if (existing) {
    throw new TemaFieldDefServiceError("Já existe um campo com essa chave neste tema/frente.", 409);
  }

  const { data, error } = await sb
    .from("system_tema_field_defs")
    .insert({
      organization_id: DEFAULT_ORG,
      tema_id: input.temaId,
      frente_slug: frenteSlug,
      key,
      label,
      type: input.type,
      options: normalizeOptions(input.type, input.options),
      ordem: input.ordem ?? 0,
      required: input.required ?? false,
    })
    .select()
    .single();
  if (error || !data)
    throw new TemaFieldDefServiceError(error?.message ?? "Falha ao criar campo", 500);
  return data;
}

export async function updateTemaFieldDef(
  id: string,
  patch: Partial<{
    label: string;
    type: string;
    options: unknown;
    ordem: number;
    required: boolean;
    active: boolean;
  }>,
): Promise<FieldDefRow> {
  const sb = getSupabaseAdmin();
  const clean: FieldDefUpdate = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) throw new TemaFieldDefServiceError("Rótulo do campo é obrigatório", 422);
    clean.label = label;
  }
  if (patch.type !== undefined) {
    if (!TEMA_FIELD_TYPES.includes(patch.type as TemaFieldType)) {
      throw new TemaFieldDefServiceError("Tipo de campo inválido", 422);
    }
    clean.type = patch.type;
  }
  if (patch.options !== undefined || patch.type !== undefined) {
    // Reavalia options quando type ou options mudam.
    const effectiveType = (patch.type ?? clean.type) as string | undefined;
    if (effectiveType !== undefined) {
      clean.options = normalizeOptions(effectiveType, patch.options);
    } else if (patch.options !== undefined) {
      clean.options = normalizeOptions("select", patch.options);
    }
  }
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;
  if (patch.required !== undefined) clean.required = patch.required;
  if (patch.active !== undefined) clean.active = patch.active;

  const { data, error } = await sb
    .from("system_tema_field_defs")
    .update(clean)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new TemaFieldDefServiceError(error?.message ?? "Falha ao atualizar campo", 500);
  return data;
}

// EXCLUI (soft-delete) uma def. Os valores já gravados em canonical_fields NÃO
// são apagados — a UI da ficha continua exibindo a chave livre remanescente.
export async function deleteTemaFieldDef(id: string): Promise<{ ok: true; id: string }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_tema_field_defs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new TemaFieldDefServiceError(error.message, 500);
  return { ok: true as const, id };
}
