// Server-only — visibilidade de CASOS por usuário.
// Advogados (e prestador externo) veem só os casos vinculados a eles: como
// CRIADOR (created_by), como RESPONSÁVEL (system_case_responsaveis) ou como
// responsável de um item de checklist (assigned_to). Admin/back-office veem tudo.

import { seesOnlyOwnCases } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";

// Retorna:
//   null      → sem restrição (vê todos os casos)
//   string[]  → conjunto de case_ids que o usuário pode ver (pode ser vazio)
export async function getVisibleCaseIds(
  viewerUserId: string | null | undefined,
): Promise<string[] | null> {
  // Sem usuário no contexto (ex.: jobs/webhooks) → não restringe.
  if (!viewerUserId) return null;

  const sb = getSupabaseAdmin();
  const { data: u } = await sb
    .from("system_users")
    .select("role")
    .eq("id", viewerUserId)
    .maybeSingle();
  const role = (u?.role ?? null) as Parameters<typeof seesOnlyOwnCases>[0];
  if (!seesOnlyOwnCases(role)) return null; // vê tudo

  const ids = new Set<string>();

  // 1) Casos que ele criou.
  const { data: created } = await sb
    .from("system_cases")
    .select("id")
    .eq("created_by", viewerUserId)
    .is("deleted_at", null);
  for (const r of created ?? []) ids.add(r.id);

  // 2) Casos onde ele é responsável.
  const { data: resp } = await sb
    .from("system_case_responsaveis_active")
    .select("case_id")
    .eq("user_id", viewerUserId);
  for (const r of resp ?? []) ids.add((r as { case_id: string }).case_id);

  // 3) Casos onde ele é responsável de algum item de checklist (item 3).
  // `assigned_to` é adicionado no item 3 (migration). Cast defensivo p/ tipos.
  const { data: chk } = await sb
    .from("system_case_checklist_items")
    .select("case_id")
    .eq("assigned_to" as never, viewerUserId as never)
    .is("deleted_at", null);
  for (const r of chk ?? []) ids.add((r as { case_id: string }).case_id);

  return [...ids];
}

// Retorna os client_ids visíveis para o usuário (para o board comercial por
// CADASTRO). Um cadastro é visível se o usuário o criou OU se tem algum caso
// visível vinculado a esse cadastro. null = sem restrição.
export async function getVisibleClientIds(
  viewerUserId: string | null | undefined,
): Promise<string[] | null> {
  if (!viewerUserId) return null;
  const sb = getSupabaseAdmin();
  const { data: u } = await sb
    .from("system_users")
    .select("role")
    .eq("id", viewerUserId)
    .maybeSingle();
  const role = (u?.role ?? null) as Parameters<typeof seesOnlyOwnCases>[0];
  if (!seesOnlyOwnCases(role)) return null;

  const ids = new Set<string>();

  // Cadastros criados por ele.
  const { data: created } = await sb
    .from("system_clients")
    .select("id")
    .eq("created_by", viewerUserId)
    .is("deleted_at", null);
  for (const r of created ?? []) ids.add(r.id);

  // Cadastros dos casos visíveis a ele.
  const caseIds = await getVisibleCaseIds(viewerUserId);
  if (caseIds && caseIds.length) {
    const { data: cases } = await sb.from("system_cases").select("client_id").in("id", caseIds);
    for (const r of cases ?? []) if (r.client_id) ids.add(r.client_id);
  }

  return [...ids];
}
