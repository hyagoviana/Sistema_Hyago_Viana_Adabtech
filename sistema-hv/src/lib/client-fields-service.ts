// Server-only — CRUD das definições de campos customizados de cliente.
// NUNCA importe este arquivo em código que roda no browser.

import slugify from "slugify";

import { getSupabaseAdmin } from "./supabase/server";
import type { Database } from "./supabase/types";
import { createTemaFieldDef, updateTemaFieldDef } from "./tema-field-defs-service";
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

  // C1 — teto e linhas iniciais andam juntos: começar acima do teto não existe.
  const maxOcc = input.max_occurrences ?? 1;
  const iniOcc = Math.min(input.initial_occurrences ?? 1, maxOcc);

  const { data, error } = await sb
    .from("system_client_field_defs")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      key,
      label: input.label,
      field_type: input.field_type,
      options: withOptions ? (input.options ?? []) : null,
      required: input.required ?? false,
      appears_in_cases: input.appears_in_cases ?? false,
      help_text: input.help_text ?? null,
      ordem,
      created_by: createdBy ?? null,
      // C1 — paridade com os campos do caso.
      max_occurrences: maxOcc,
      initial_occurrences: iniOcc,
      subtitle_mode: input.subtitle_mode ?? null,
      subtitles: (input.subtitles ?? []) as never,
      parent_field_def_id: input.parent_field_def_id ?? null,
      linked_field_def_id: input.linked_field_def_id ?? null,
      hidden_in_list: input.hidden_in_list ?? false,
      hidden_in_filters: input.hidden_in_filters ?? false,
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

/**
 * Aplica o VÍNCULO entre dois campos do cliente (C1).
 *
 * Thiago: "não é que ele depende daquele outro, é que eles são juntos (…) na hora
 * que eu marco que esse aqui é vinculado no outro, lá na situação eles aparecem
 * juntinhos".
 *
 * Regras (as três protegem o mesmo conceito — vínculo é PAR, não corrente):
 *   • simétrico  — marcar A→B grava também B→A;
 *   • 1↔1        — se A ou B já tinham par, o par antigo é desfeito;
 *   • sem cadeia — o alvo não pode ser um campo que já é "meio" de outro par
 *                  diferente (isso viraria A→B→C e ninguém saberia o que agrupa).
 */
async function aplicarVinculo(
  sb: ReturnType<typeof getSupabaseAdmin>,
  id: string,
  alvoId: string | null,
): Promise<void> {
  const { data: atual } = await sb
    .from("system_client_field_defs")
    .select("id, linked_field_def_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!atual) throw new FieldDefServiceError("Campo não encontrado", "NOT_FOUND", 404);

  const parAntigo = (atual as { linked_field_def_id?: string | null }).linked_field_def_id ?? null;

  // Desfaz o par anterior dos dois lados (se havia).
  if (parAntigo && parAntigo !== alvoId) {
    await sb
      .from("system_client_field_defs")
      .update({ linked_field_def_id: null } as FieldDefUpdate)
      .eq("id", parAntigo);
  }

  if (!alvoId) {
    await sb
      .from("system_client_field_defs")
      .update({ linked_field_def_id: null } as FieldDefUpdate)
      .eq("id", id);
    return;
  }

  if (alvoId === id) {
    throw new FieldDefServiceError("Um campo não pode ser vinculado a ele mesmo", "DB_ERROR", 422);
  }

  const { data: alvo } = await sb
    .from("system_client_field_defs")
    .select("id, linked_field_def_id")
    .eq("id", alvoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!alvo) throw new FieldDefServiceError("Campo a vincular não encontrado", "NOT_FOUND", 404);

  const parDoAlvo = (alvo as { linked_field_def_id?: string | null }).linked_field_def_id ?? null;
  if (parDoAlvo && parDoAlvo !== id) {
    // Desfaz o par antigo do alvo — 1↔1, sem cadeia.
    await sb
      .from("system_client_field_defs")
      .update({ linked_field_def_id: null } as FieldDefUpdate)
      .eq("id", parDoAlvo);
  }

  await sb
    .from("system_client_field_defs")
    .update({ linked_field_def_id: alvoId } as FieldDefUpdate)
    .eq("id", id);
  await sb
    .from("system_client_field_defs")
    .update({ linked_field_def_id: id } as FieldDefUpdate)
    .eq("id", alvoId);
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
  if (input.appears_in_cases !== undefined) patch.appears_in_cases = input.appears_in_cases;
  if (input.help_text !== undefined) patch.help_text = input.help_text;
  if (input.ordem !== undefined) patch.ordem = input.ordem;
  if (input.active !== undefined) patch.active = input.active;
  // C1 — paridade com os campos do caso.
  if (input.max_occurrences !== undefined) patch.max_occurrences = input.max_occurrences;
  if (input.initial_occurrences !== undefined)
    patch.initial_occurrences = input.initial_occurrences;
  if (input.subtitle_mode !== undefined) patch.subtitle_mode = input.subtitle_mode ?? null;
  if (input.subtitles !== undefined) patch.subtitles = input.subtitles ?? [];
  if (input.parent_field_def_id !== undefined)
    patch.parent_field_def_id = input.parent_field_def_id ?? null;
  if (input.hidden_in_list !== undefined) patch.hidden_in_list = input.hidden_in_list;
  if (input.hidden_in_filters !== undefined) patch.hidden_in_filters = input.hidden_in_filters;
  // options só faz sentido para select/multiselect; limpa caso contrário.
  if (input.options !== undefined) patch.options = input.options;
  if (
    input.field_type !== undefined &&
    input.field_type !== "select" &&
    input.field_type !== "multiselect"
  ) {
    patch.options = null;
  }

  // C1 — VÍNCULO: 1↔1 e simétrico. Marcar A→B implica B→A, senão o par "aparece
  // junto" só de um lado. Cadeia (A→B→C) é recusada: o conceito é PAR.
  if (input.linked_field_def_id !== undefined) {
    await aplicarVinculo(sb, id, input.linked_field_def_id ?? null);
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

  // B1 — excluir o campo do cliente também desfaz a bifurcação: soft-delete de
  // todos os vínculos e oculta as defs-espelho nos temas (o valor já vai ser
  // purgado abaixo; as defs de tema não são deletadas, só ocultadas).
  const links = await listClientFieldTemaLinks(id);
  if (links.length > 0) {
    await reconcileClientFieldTemaLinks(id, []);
  }

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

// ----------------------------------------------------------------------------
// B1 (2026-08-05) — VÍNCULO campo-do-cliente → tema(s) + BIFURCAÇÃO.
// ----------------------------------------------------------------------------
// D1 = tabela N:N `system_client_field_tema_links`; D2 = o vínculo é MESTRE: a
// def-espelho em system_tema_field_defs (scope='cliente', mesma key/label) é
// DERIVADA e reconciliada aqui. O VALOR é sempre o do balde único do cliente
// (system_clients.custom_fields[key]) — nada é duplicado por tema.
//
// Mapeamento de tipo: o campo do cliente tem 'textarea', que o tema não conhece.
// A def-espelho usa 'text' nesse caso (o balde é string livre; sem perda de dado).
function mirrorTemaType(clientFieldType: string): string {
  return clientFieldType === "textarea" ? "text" : clientFieldType;
}

// Lista os tema_ids atualmente vinculados a um campo do cliente (ativos).
export async function listClientFieldTemaLinks(clientFieldDefId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_client_field_tema_links_active")
    .select("tema_id")
    .eq("client_field_def_id", clientFieldDefId);
  if (error) throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
  return (data ?? []).map((r) => r.tema_id as string);
}

// Garante/reativa a def-espelho scope='cliente' no tema (idempotente). Usa a
// MESMA key do campo do cliente (não deixa o tema re-slugar) — é o casamento de
// key que faz o dado refletir em todos os temas.
async function ensureMirrorDef(
  sb: ReturnType<typeof getSupabaseAdmin>,
  tema_id: string,
  clientDef: {
    key: string;
    label: string;
    field_type: string;
    options: unknown;
    // C1 (QA-14) — sem estes, um campo do cliente com 3 linhas e subtítulo virava
    // um campo simples no tema: o mesmo dado apareceria diferente nos dois lugares.
    max_occurrences?: number;
    initial_occurrences?: number;
    subtitle_mode?: string | null;
    subtitles?: unknown;
  },
): Promise<void> {
  // Já existe uma def de tema com essa key nesse tema/painel padrão?
  const { data: existing } = await sb
    .from("system_tema_field_defs")
    .select("id, active, deleted_at")
    .eq("tema_id", tema_id)
    .eq("key", clientDef.key)
    .is("frente_slug", null)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    // Reativa se estava oculta (nunca recria — reusa o mesmo conceito/key).
    if (existing.active === false) {
      await updateTemaFieldDef(existing.id as string, { active: true });
    }
    return;
  }

  // Cria a def-espelho. Mesmo rótulo ⇒ findClientBucketKeyConflict não conflita.
  // rawKey: usa a key do cliente VERBATIM (não re-slugar) — é o casamento de key
  // que faz o dado do cliente refletir em todos os temas.
  await createTemaFieldDef({
    temaId: tema_id,
    frenteSlug: null,
    key: clientDef.key,
    rawKey: true,
    label: clientDef.label,
    type: mirrorTemaType(clientDef.field_type),
    options: clientDef.options,
    scope: "cliente",
    // C1 (QA-14) — o espelho reproduz a FORMA do campo, não só o tipo.
    maxOccurrences: clientDef.max_occurrences ?? 1,
    initialOccurrences: clientDef.initial_occurrences ?? 1,
    subtitleMode: (clientDef.subtitle_mode ?? null) as "auto" | "custom" | null,
    subtitles: Array.isArray(clientDef.subtitles)
      ? (clientDef.subtitles.filter((x) => typeof x === "string") as string[])
      : [],
  });
}

// Oculta (soft) a def-espelho scope='cliente' do tema — nunca apaga o dado do
// cliente. Só desativa a def que compartilha a key do campo do cliente.
async function hideMirrorDef(
  sb: ReturnType<typeof getSupabaseAdmin>,
  tema_id: string,
  key: string,
): Promise<void> {
  const { data: existing } = await sb
    .from("system_tema_field_defs")
    .select("id")
    .eq("tema_id", tema_id)
    .eq("key", key)
    .eq("scope", "cliente")
    .is("frente_slug", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    await updateTemaFieldDef(existing.id as string, { active: false });
  }
}

// Reconcilia os vínculos de um campo do cliente para o conjunto DESEJADO de
// temas: diff contra o estado atual, grava/soft-deleta em
// system_client_field_tema_links e cria/oculta as defs-espelho idempotentemente.
export async function reconcileClientFieldTemaLinks(
  clientFieldDefId: string,
  temaIds: string[],
  createdBy?: string,
): Promise<{ ok: true; linked: string[] }> {
  const sb = getSupabaseAdmin();

  // Carrega o campo do cliente (key/label/type/options — fonte da def-espelho).
  const { data: clientDef } = await sb
    .from("system_client_field_defs")
    .select(
      "id, key, label, field_type, options, organization_id, max_occurrences, initial_occurrences, subtitle_mode, subtitles",
    )
    .eq("id", clientFieldDefId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!clientDef) throw new FieldDefServiceError("Campo não encontrado", "NOT_FOUND", 404);

  const desired = new Set(temaIds);
  const current = new Set(await listClientFieldTemaLinks(clientFieldDefId));

  const toAdd = [...desired].filter((t) => !current.has(t));
  const toRemove = [...current].filter((t) => !desired.has(t));

  const clientInfo = {
    key: clientDef.key as string,
    label: clientDef.label as string,
    field_type: clientDef.field_type as string,
    options: clientDef.options,
    max_occurrences: (clientDef as { max_occurrences?: number }).max_occurrences ?? 1,
    initial_occurrences: (clientDef as { initial_occurrences?: number }).initial_occurrences ?? 1,
    subtitle_mode: (clientDef as { subtitle_mode?: string | null }).subtitle_mode ?? null,
    subtitles: (clientDef as { subtitles?: unknown }).subtitles,
  };

  // ADD: (a) upsert do vínculo (reativa se havia soft-delete); (b) def-espelho.
  for (const tema_id of toAdd) {
    // Reativa um vínculo soft-deletado ou insere um novo.
    const { data: dead } = await sb
      .from("system_client_field_tema_links")
      .select("id")
      .eq("client_field_def_id", clientFieldDefId)
      .eq("tema_id", tema_id)
      .not("deleted_at", "is", null)
      .maybeSingle();
    if (dead) {
      const { error } = await sb
        .from("system_client_field_tema_links")
        .update({ deleted_at: null })
        .eq("id", dead.id as string);
      if (error) throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
    } else {
      const { error } = await sb.from("system_client_field_tema_links").insert({
        organization_id: clientDef.organization_id as string,
        client_field_def_id: clientFieldDefId,
        tema_id,
        created_by: createdBy ?? null,
      });
      // Ignora corrida com o índice único (23505) — vínculo já existe ativo.
      if (error && error.code !== "23505") {
        throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
      }
    }
    await ensureMirrorDef(sb, tema_id, clientInfo);
  }

  // REMOVE: soft-delete do vínculo + oculta a def-espelho (dado do cliente fica).
  for (const tema_id of toRemove) {
    const { error } = await sb
      .from("system_client_field_tema_links")
      .update({ deleted_at: new Date().toISOString() })
      .eq("client_field_def_id", clientFieldDefId)
      .eq("tema_id", tema_id)
      .is("deleted_at", null);
    if (error) throw new FieldDefServiceError(error.message, "DB_ERROR", 500);
    await hideMirrorDef(sb, tema_id, clientInfo.key);
  }

  return { ok: true as const, linked: [...desired] };
}
