// ============================================================================
// RBAC — fonte única da verdade dos papéis, navegação e capacidades.
// Espelha o desenho do PRD num modelo pragmático (1 papel por usuário).
// Usado tanto nos gates de UI (Sidebar, botões) quanto na tela de gestão.
// ============================================================================

export const ROLES = [
  "admin",
  "advogado_titular",
  "advogado_associado",
  "prestador_externo",
  "controladoria",
  "comercial",
  "financeiro",
  "operacional",
  "marketing",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  advogado_titular: "Advogado Titular",
  advogado_associado: "Advogado Associado",
  prestador_externo: "Prestador Externo",
  controladoria: "Controladoria",
  comercial: "Comercial",
  financeiro: "Financeiro",
  operacional: "Operacional",
  marketing: "Marketing",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Acesso total ao sistema, incluindo gestão de usuários e configurações.",
  advogado_titular: "Visão completa de casos, clientes, financeiro e inteligência.",
  advogado_associado: "Casos, clientes, prazos e peticionamento. Sem gestão de usuários.",
  prestador_externo: "Acesso restrito aos casos e tarefas atribuídos.",
  controladoria: "Casos, prazos e controladoria. Foco em conformidade processual.",
  comercial: "Clientes, funil comercial e atendimento (WhatsApp).",
  financeiro: "Pipeline financeira, cobranças e inadimplência.",
  operacional: "Casos operacionais, clientes e tarefas do dia a dia.",
  marketing: "Marketing e dashboards de performance.",
};

// ---------------------------------------------------------------------------
// Capacidades (ações) — gates finos para botões/operações sensíveis.
// ---------------------------------------------------------------------------
export type Capability =
  | "clientes.manage" // criar/editar/excluir clientes
  | "casos.manage" // mover/editar casos operacionais
  | "financeiro.manage" // mover casos na pipeline financeira
  | "documentos.upload" // subir documentos
  | "dossie.manage" // tarefas/prazos/comunicações
  | "usuarios.manage" // gestão de usuários (convite, papel, status)
  | "config.manage"; // configurações do sistema

const ALL_CAPS: Capability[] = [
  "clientes.manage",
  "casos.manage",
  "financeiro.manage",
  "documentos.upload",
  "dossie.manage",
  "usuarios.manage",
  "config.manage",
];

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: ALL_CAPS,
  advogado_titular: [
    "clientes.manage",
    "casos.manage",
    "financeiro.manage",
    "documentos.upload",
    "dossie.manage",
  ],
  advogado_associado: ["clientes.manage", "casos.manage", "documentos.upload", "dossie.manage"],
  prestador_externo: ["documentos.upload", "dossie.manage"],
  controladoria: ["casos.manage", "dossie.manage"],
  comercial: ["clientes.manage"],
  financeiro: ["financeiro.manage"],
  operacional: ["clientes.manage", "casos.manage", "documentos.upload", "dossie.manage"],
  marketing: [],
};

/** Papel `role` tem a capacidade `cap`? `null`/desconhecido → false. */
export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}

// ---------------------------------------------------------------------------
// Navegação — quais rotas (sidebar `to`) cada papel enxerga.
// "all" = todas. Lista = subconjunto explícito.
// ---------------------------------------------------------------------------
const ROLE_NAV: Record<Role, "all" | string[]> = {
  admin: "all",
  advogado_titular: "all",
  advogado_associado: [
    "/hoje",
    "/casos",
    "/pipeline",
    "/casos/financeiro",
    "/clientes",
    "/tarefas",
    "/controladoria",
    "/peticionamento",
    "/comercial",
    "/comercial/leads",
    "/dashboards",
    "/configuracoes",
  ],
  prestador_externo: ["/hoje", "/casos", "/tarefas", "/configuracoes"],
  controladoria: ["/hoje", "/casos", "/controladoria", "/tarefas", "/dashboards", "/configuracoes"],
  comercial: [
    "/hoje",
    "/clientes",
    "/comercial",
    "/comercial/leads",
    "/comercial/assinaturas",
    "/whatsapp",
    "/dashboards",
    "/configuracoes",
  ],
  financeiro: ["/hoje", "/casos/financeiro", "/clientes", "/dashboards", "/configuracoes"],
  operacional: ["/hoje", "/casos", "/pipeline", "/clientes", "/tarefas", "/configuracoes"],
  marketing: ["/hoje", "/marketing", "/dashboards", "/configuracoes"],
};

/** Papel `role` pode ver a rota `to`? Default permissivo só para o admin. */
export function canSeeRoute(role: Role | null | undefined, to: string): boolean {
  if (!role) return false;
  const nav = ROLE_NAV[role];
  if (nav === "all") return true;
  return nav.includes(to);
}
