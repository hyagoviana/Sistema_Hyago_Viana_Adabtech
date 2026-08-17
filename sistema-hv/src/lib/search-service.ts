// Server-only — BUSCA GLOBAL da topbar (lupa "Buscar caso, cliente, documento…").
// Pesquisa em casos, clientes, documentos, TEMAS e PÁGINAS/abas do sistema,
// respeitando a visibilidade RBAC do usuário. NUNCA importe no browser.

import { getSupabaseAdmin } from "./supabase/server";
import { getVisibleCaseIds, getVisibleClientIds } from "./visibility";

export type SearchResultType = "caso" | "cliente" | "documento" | "tema" | "pagina";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  label: string; // texto principal
  sublabel: string; // texto secundário
  ramificacao: string; // ONDE a busca leva (breadcrumb: "Operação › Pipeline…")
  to: string; // rota de navegação ao clicar
};

const PER_KIND = 6;

// Páginas/abas do sistema — para a lupa também navegar pela interface.
const PAGES: { label: string; to: string; ram: string }[] = [
  { label: "Hoje", to: "/hoje", ram: "Operação" },
  { label: "Área de Trabalho", to: "/pipeline", ram: "Operação" },
  { label: "Clientes", to: "/clientes", ram: "Operação" },
  { label: "Tarefas", to: "/tarefas", ram: "Operação" },
  { label: "Cadastro (Leads)", to: "/inteligencia/leads", ram: "Comercial" },
  { label: "Comercial", to: "/comercial", ram: "Comercial" },
  { label: "Pipeline Comercial", to: "/comercial/leads", ram: "Comercial" },
  { label: "Assinaturas", to: "/comercial/assinaturas", ram: "Comercial" },
  { label: "Pipeline Financeira", to: "/casos/financeiro", ram: "Financeiro" },
  { label: "Relatório Financeiro", to: "/relatorio-financeiro", ram: "Financeiro" },
  { label: "Controladoria", to: "/controladoria", ram: "Inteligência" },
  { label: "Peticionamento", to: "/peticionamento", ram: "Inteligência" },
  { label: "WhatsApp", to: "/whatsapp", ram: "Inteligência" },
  { label: "Dashboards", to: "/dashboards", ram: "Inteligência" },
  { label: "Marketing", to: "/marketing", ram: "Marketing" },
  { label: "Referências", to: "/referencias", ram: "Sistema" },
  { label: "Permissões", to: "/permissoes", ram: "Sistema" },
  { label: "Configurações", to: "/configuracoes", ram: "Sistema" },
];

// Escapa os caracteres que quebram o filtro `.or()` do PostgREST e o LIKE.
function sanitize(term: string): string {
  return term.trim().replace(/[%,()]/g, "");
}
// Normaliza para comparação client-side (páginas/temas): sem acento, minúsculo.
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export async function globalSearch(
  rawTerm: string,
  viewerUserId?: string,
): Promise<SearchResult[]> {
  const term = sanitize(rawTerm);
  if (term.length < 2) return [];

  const sb = getSupabaseAdmin();
  const like = `%${term}%`;
  const nterm = norm(term);
  const results: SearchResult[] = [];

  const visibleCases = await getVisibleCaseIds(viewerUserId);
  const visibleClients = await getVisibleClientIds(viewerUserId);
  const casesBlocked = visibleCases !== null && visibleCases.length === 0;
  const clientsBlocked = visibleClients !== null && visibleClients.length === 0;

  // --- Páginas/abas (navegação) ---
  for (const p of PAGES) {
    if (norm(p.label).includes(nterm) || norm(p.ram).includes(nterm)) {
      results.push({
        type: "pagina",
        id: p.to,
        label: p.label,
        sublabel: "Abrir a página",
        ramificacao: p.ram,
        to: p.to,
      });
    }
  }

  // --- Temas ---
  {
    const { data } = await sb
      .from("system_temas_active")
      .select("id, name")
      .ilike("name", like)
      .limit(PER_KIND);
    for (const t of data ?? []) {
      results.push({
        type: "tema",
        id: t.id,
        label: t.name,
        sublabel: "Tema",
        ramificacao: "Operação › Área de Trabalho",
        to: "/pipeline",
      });
    }
  }

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
        ramificacao: "Operação › Caso",
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
        ramificacao: "Operação › Clientes",
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
        ramificacao: "Operação › Caso › Documentos",
        to: `/casos/${d.case_id}`,
      });
    }
  }

  return results;
}
