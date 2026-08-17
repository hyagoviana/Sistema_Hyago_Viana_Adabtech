// Server-only — Notas livres de cliente e caso (S4-03).
//   - CRUD server-side (criar/editar/soft-delete) + listagem.
//   - Auth-only: qualquer usuário AUTENTICADO lê/escreve (sem gate por cargo).
//     O guard exige apenas userId não-null (recusa chamada não autenticada).
//   - Auditoria: created_by + timestamps. Soft-delete: deleted_by/deleted_at
//     (NUNCA hard-delete; a trilha é preservada).
// NUNCA importe este arquivo em código que roda no browser.

import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class NoteServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "NoteServiceError";
  }
}

export type Note = {
  id: string;
  organization_id: string;
  body: string;
  // F1 — balde da nota do CASO: 'geral' (ficha comum) | 'financeiro' (submenu).
  // Notas de CLIENTE não têm scope (sempre indefinido).
  scope?: string;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  case_id?: string;
  client_id?: string;
};

// F1 — escopos válidos das notas do CASO. 'geral' = bloco de Notas da ficha
// comum; 'financeiro' = comentários dentro do submenu financeiro (gate próprio).
export type CaseNoteScope = "geral" | "financeiro" | "observacao";

function requireUser(userId: string) {
  if (!userId) throw new NoteServiceError("Ação exige usuário autenticado", 401);
}

function requireBody(body: string): string {
  const trimmed = (body ?? "").trim();
  if (!trimmed) throw new NoteServiceError("A nota não pode ficar vazia", 422);
  return trimmed;
}

// Resolve nomes de autores em lote (created_by → full_name). created_by não tem
// FK para system_users (padrão do sistema), então buscamos em query separada em
// vez de embed PostgREST.
async function attachAuthorNames(rows: Note[]): Promise<Note[]> {
  const ids = Array.from(new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)));
  if (ids.length === 0) return rows.map((r) => ({ ...r, created_by_name: null }));
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("system_users").select("id, full_name").in("id", ids);
  const nameById = new Map((data ?? []).map((u) => [u.id, u.full_name]));
  return rows.map((r) => ({
    ...r,
    created_by_name: r.created_by ? (nameById.get(r.created_by) ?? null) : null,
  }));
}

// ----------------------------------------------------------------------------
// LISTAGEM (via view _active — só não-excluídos), mais recentes primeiro.
// ----------------------------------------------------------------------------
export async function listCaseNotes(
  caseId: string,
  scope: CaseNoteScope = "geral",
): Promise<Note[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_notes_active")
    .select("*")
    .eq("case_id", caseId)
    .eq("scope", scope)
    .order("created_at", { ascending: false });
  if (error) throw new NoteServiceError(error.message, 500);
  return attachAuthorNames((data ?? []) as Note[]);
}

export async function listClientNotes(clientId: string): Promise<Note[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_client_notes_active")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new NoteServiceError(error.message, 500);
  return attachAuthorNames((data ?? []) as Note[]);
}

// ----------------------------------------------------------------------------
// CRIAÇÃO — grava created_by (ator não-null) + organization_id da entidade.
// ----------------------------------------------------------------------------
export async function createCaseNote(
  caseId: string,
  body: string,
  userId: string,
  scope: CaseNoteScope = "geral",
) {
  requireUser(userId);
  const cleanBody = requireBody(body);
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new NoteServiceError("Caso não encontrado", 404);

  const { data, error } = await sb
    .from("system_case_notes")
    .insert({
      organization_id: caso.organization_id ?? DEFAULT_ORG_ID,
      case_id: caseId,
      body: cleanBody,
      scope,
      created_by: userId,
    })
    .select()
    .single();
  if (error || !data) throw new NoteServiceError(error?.message ?? "Falha ao criar nota", 500);

  // A6 (2026-08-03) — a linha do tempo registra TODA a movimentação do caso,
  // inclusive a criação de nota. Best-effort: nunca derruba a criação da nota.
  // F1 — comentários do FINANCEIRO NÃO geram evento na timeline (exclusivos do
  // submenu). #6 (2026-08-17) — Observações também têm painel PRÓPRIO (não vazam
  // p/ a linha do tempo). Só o balde 'geral' registra evento na timeline.
  if (scope === "geral") {
    await sb
      .from("system_case_events")
      .insert({
        case_id: caseId,
        organization_id: caso.organization_id ?? DEFAULT_ORG_ID,
        action: "note_added",
        diff: { note_id: data.id, note_preview: cleanBody.slice(0, 140) },
        triggered_by: userId,
      })
      .then(
        () => {},
        () => {},
      );
  }

  return data;
}

export async function createClientNote(clientId: string, body: string, userId: string) {
  requireUser(userId);
  const cleanBody = requireBody(body);
  const sb = getSupabaseAdmin();

  const { data: cliente } = await sb
    .from("system_clients")
    .select("id, organization_id")
    .eq("id", clientId)
    .is("deleted_at", null)
    .single();
  if (!cliente) throw new NoteServiceError("Cliente não encontrado", 404);

  const { data, error } = await sb
    .from("system_client_notes")
    .insert({
      organization_id: cliente.organization_id ?? DEFAULT_ORG_ID,
      client_id: clientId,
      body: cleanBody,
      created_by: userId,
    })
    .select()
    .single();
  if (error || !data) throw new NoteServiceError(error?.message ?? "Falha ao criar nota", 500);
  return data;
}

// M1 (2026-08-07) — regra Trello opcional (só a ficha comua liga). Busca o dono
// da nota e valida: editar SÓ o autor; excluir o autor OU admin. `enforceOwner`
// fica FALSE por padrão para não regredir os RPCs financeiros (gate por módulo).
async function loadNoteOwner(
  table: "system_case_notes" | "system_client_notes",
  noteId: string,
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(table)
    .select("created_by")
    .eq("id", noteId)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new NoteServiceError("Nota não encontrada", 404);
  return (data as { created_by: string | null }).created_by;
}

// ----------------------------------------------------------------------------
// EDIÇÃO — atualiza body (updated_at via trigger). Só notas não-excluídas.
//   - `enforceOwner`: quando true (ficha comum/M1), SÓ o autor edita (403).
// ----------------------------------------------------------------------------
export async function updateNote(
  target: "case" | "client",
  noteId: string,
  body: string,
  userId: string,
  opts?: { enforceOwner?: boolean },
) {
  requireUser(userId);
  const cleanBody = requireBody(body);
  const sb = getSupabaseAdmin();
  const table = target === "case" ? "system_case_notes" : "system_client_notes";

  if (opts?.enforceOwner) {
    const owner = await loadNoteOwner(table, noteId);
    if (owner !== userId)
      throw new NoteServiceError("Você só pode editar os seus próprios comentários", 403);
  }

  const { data, error } = await sb
    .from(table)
    .update({ body: cleanBody })
    .eq("id", noteId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new NoteServiceError(error?.message ?? "Nota não encontrada", 404);
  return data;
}

// ----------------------------------------------------------------------------
// SOFT-DELETE — grava deleted_by/deleted_at. NUNCA hard-delete.
//   - `enforceOwner`: quando true (ficha comum/M1), exclui o autor OU um admin.
// ----------------------------------------------------------------------------
export async function softDeleteNote(
  target: "case" | "client",
  noteId: string,
  userId: string,
  opts?: { enforceOwner?: boolean; isAdmin?: boolean },
) {
  requireUser(userId);
  const sb = getSupabaseAdmin();
  const table = target === "case" ? "system_case_notes" : "system_client_notes";

  if (opts?.enforceOwner) {
    const owner = await loadNoteOwner(table, noteId);
    if (owner !== userId && !opts.isAdmin)
      throw new NoteServiceError(
        "Você só pode excluir os seus próprios comentários (admin pode excluir de qualquer um)",
        403,
      );
  }

  const { data, error } = await sb
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", noteId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new NoteServiceError(error?.message ?? "Nota não encontrada", 404);
  return { ok: true as const, id: noteId };
}
