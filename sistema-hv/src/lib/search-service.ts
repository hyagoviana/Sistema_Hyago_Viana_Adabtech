// Server-only — BUSCA GLOBAL da topbar (lupa "Buscar caso, cliente, documento…").
// Pesquisa em casos, clientes e documentos, respeitando a visibilidade RBAC do
// usuário (advogado vê só o que é dele; admin vê tudo). NUNCA importe no browser.

import { getSupabaseAdmin } from "./supabase/server";
import { getVisibleCaseIds, getVisibleClientIds } from "./visibility";

export type SearchResultType = "caso" | "cliente" | "documento";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  label: string; // texto principal (código do caso / nome / título do doc)
  sublabel: string; // texto secundário (cliente / CPF / "Documento")
  to: string; // rota de navegação ao clicar
};

const PER_KIND = 6;

// Escapa os caracteres que quebram o filtro `.or()` do PostgREST e o LIKE.
function sanitize(term: string): string {
  return term.trim().replace(/[%,()]/g, "");
}

export async function globalSearch(
  rawTerm: string,
  viewerUserId?: string,
): Promise<SearchResult[]> {
  const term = sanitize(rawTerm);
  if (term.length < 2) return [];

  const sb = getSupabaseAdmin();
  const like = `%${term}%`;
  const results: SearchResult[] = [];

  const visibleCases = await getVisibleCaseIds(viewerUserId);
  const visibleClients = await getVisibleClientIds(viewerUserId);
  const casesBlocked = visibleCases !== null && visibleCases.length === 0;
  const clientsBlocked = visibleClients !== null && visibleClients.length === 0;

  // --- Casos (código do caso ou nome do cliente) ---
  if (!casesBlocked) {
    let q = sb
      .from("system_cases_active")
      .select("id, case_code, client_name")
      .or(`case_code.ilike.${like},client_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(PER_KIND);
    if (visibleCases !== null) q = q.in("id", visibleCases);
    const { data } = await q;
    for (const c of data ?? []) {
      results.push({
        type: "caso",
        id: c.id,
        label: c.case_code,
        sublabel: c.client_name ?? "",
        to: `/casos/${c.id}`,
      });
    }
  }

  // --- Clientes (nome ou CPF/CNPJ) ---
  if (!clientsBlocked) {
    let q = sb
      .from("system_clients")
      .select("id, full_name, cpf_cnpj")
      .is("deleted_at", null)
      .or(`full_name.ilike.${like},cpf_cnpj.ilike.${like}`)
      .order("full_name", { ascending: true })
      .limit(PER_KIND);
    if (visibleClients !== null) q = q.in("id", visibleClients);
    const { data } = await q;
    for (const c of data ?? []) {
      results.push({
        type: "cliente",
        id: c.id,
        label: c.full_name,
        sublabel: c.cpf_cnpj ?? "",
        to: `/clientes/${c.id}`,
      });
    }
  }

  // --- Documentos (título) — só dos casos visíveis ---
  if (!casesBlocked) {
    let q = sb
      .from("system_case_documents")
      .select("id, title, case_id")
      .is("deleted_at", null)
      .ilike("title", like)
      .limit(PER_KIND);
    if (visibleCases !== null) q = q.in("case_id", visibleCases);
    const { data } = await q;
    for (const d of data ?? []) {
      results.push({
        type: "documento",
        id: d.id,
        label: d.title,
        sublabel: "Documento",
        to: `/casos/${d.case_id}`,
      });
    }
  }

  return results;
}
