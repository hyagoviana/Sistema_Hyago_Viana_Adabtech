// Server-only — CRUD das definições de campos customizados de cliente.
// NUNCA importe este arquivo em código que roda no browser.

import slugify from "slugify";

import { getSupabaseAdmin } from "./supabase/server";
import type { Database } from "./supabase/types";
import type { FieldDefCreateOutput, FieldDefUpdateOutput } from "./validators/clientFields";

type FieldDefUpdate = Database["public"]["Tables"]["system_client_field_defs"]["Update"];

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class FieldDefServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "DUPLICATE_KEY" | "NOT_FOUND" | "DB_ERROR",
    public readonly status: number,
  ) {
    super(message);
    this.name = "FieldDefServiceError";
  }
}

function baseKey(label: string): string {
  const slug = slugify(label, { lower: true, strict: true, locale: "pt" }).replace(/-/g, "_");
  return slug || "campo";
}

// Garante key único na org (acrescenta sufixo numérico se já existir).
async function uniqueKey(label: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const base = baseKey(label);
  const { data } = await sb
    .from("system_client_field_defs_active")
    .select("key")
    .eq("organization_id", DEFAULT_ORG_ID);
  const existing = new Set((data ?? []).map((r) => r.key));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

// ----------------------------------------------------------------------------
// READ — usado pelo formulário (todos) e pela tela de gestão (admin)
// ----------------------------------------------------------------------------
export async function listFieldDefs() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_client_field_defs_active")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("ordem")
    .order("created_at");
  if (error) throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
  return data ?? [];
}

// ----------------------------------------------------------------------------
// CREATE
// ----------------------------------------------------------------------------
export async function createFieldDef(input: FieldDefCreateOutput, createdBy?: string) {
  const sb = getSupabaseAdmin();
  const key = await uniqueKey(input.label);

  // ordem = fim da lista, salvo se informado.
  let ordem = input.ordem;
  if (ordem === undefined) {
    const { data: last } = await sb
      .from("system_client_field_defs_active")
      .select("ordem")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    ordem = (last?.ordem ?? -1) + 1;
  }

  const withOptions = input.field_type === "select" || input.field_type === "multiselect";

  const { data, error } = await sb
    .from("system_client_field_defs")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      key,
      label: input.label,
      field_type: input.field_type,
      options: withOptions ? (input.options ?? []) : null,
      required: input.required ?? false,
      help_text: input.help_text ?? null,
      ordem,
      created_by: createdBy ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new FieldDefServiceError(
        "Já existe um campo com esse identificador",
        "DUPLICATE_KEY",
        409,
      );
    }
    throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
  }
  return data;
}

// ----------------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------------
export async function updateFieldDef(id: string, input: FieldDefUpdateOutput) {
  const sb = getSupabaseAdmin();

  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.field_type !== undefined) patch.field_type = input.field_type;
  if (input.required !== undefined) patch.required = input.required;
  if (input.help_text !== undefined) patch.help_text = input.help_text;
  if (input.ordem !== undefined) patch.ordem = input.ordem;
  if (input.active !== undefined) patch.active = input.active;
  // options só faz sentido para select/multiselect; limpa caso contrário.
  if (input.options !== undefined) patch.options = input.options;
  if (
    input.field_type !== undefined &&
    input.field_type !== "select" &&
    input.field_type !== "multiselect"
  ) {
    patch.options = null;
  }

  const { data, error } = await sb
    .from("system_client_field_defs")
    .update(patch as FieldDefUpdate)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new FieldDefServiceError("Campo não encontrado", "NOT_FOUND", 404);
    }
    throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
  }
  if (!data) throw new FieldDefServiceError("Campo não encontrado", "NOT_FOUND", 404);
  return data;
}

// ----------------------------------------------------------------------------
// OCULTAR / MOSTRAR — esconde o campo do formulário SEM apagar dados (active).
// ----------------------------------------------------------------------------
export async function setFieldActive(id: string, active: boolean) {
  return updateFieldDef(id, { active });
}

// ----------------------------------------------------------------------------
// DELETE (definitivo dos VALORES) — soft-delete da definição E purga a "coluna"
// custom_fields de TODOS os clientes da organização. Diferente de ocultar.
// ----------------------------------------------------------------------------
export async function deleteFieldDef(id: string) {
  const sb = getSupabaseAdmin();

  const { data: def } = await sb
    .from("system_client_field_defs")
    .select("id, key, organization_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!def) throw new FieldDefServiceError("Campo não encontrado", "NOT_FOUND", 404);

  // Purga os valores daquele campo em todos os clientes (JSONB key removal).
  const { error: purgeErr } = await sb.rpc("system_fn_purge_client_field", {
    p_org: def.organization_id,
    p_key: def.key,
  });
  if (purgeErr) throw new FieldDefServiceError(purgeErr.message, "DB_ERROR", 500);

  const now = new Date().toISOString();
  const { error } = await sb
    .from("system_client_field_defs")
    .update({ deleted_at: now, active: false })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new FieldDefServiceError(error.message, "DB_ERROR", 500);

  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// REORDER — recebe a lista de ids na nova ordem.
// ----------------------------------------------------------------------------
export async function reorderFieldDefs(ids: string[]) {
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb
      .from("system_client_field_defs")
      .update({ ordem: i })
      .eq("id", ids[i])
      .eq("organization_id", DEFAULT_ORG_ID)
      .is("deleted_at", null);
    if (error) throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
  }
  return { ok: true as const };
}
