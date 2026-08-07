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
// Visibilidade de CASOS por usuário (2026-07-09).
// Advogados (titular/associado) e prestador externo veem SOMENTE os casos
// vinculados a eles (criador, responsável ou responsável de checklist). Os demais
// papéis (admin, back-office) veem tudo. Editar esta lista muda o escopo.
// ---------------------------------------------------------------------------
const OWN_CASES_ONLY_ROLES: Role[] = [
  "advogado_titular",
  "advogado_associado",
  "prestador_externo",
];

/** `true` se o papel só enxerga os casos vinculados a ele (não vê a base toda). */
export function seesOnlyOwnCases(role: Role | null | undefined): boolean {
  if (!role) return false;
  return OWN_CASES_ONLY_ROLES.includes(role);
}

/** Papéis que podem ser RESPONSÁVEIS por um caso (aparecem no seletor). */
export function isAdvogado(role: Role | null | undefined): boolean {
  return role === "advogado_titular" || role === "advogado_associado";
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
    "/relatorio-financeiro",
    "/clientes",
    "/comercial/assinaturas",
    "/tarefas",
    "/controladoria",
    "/peticionamento",
    "/inteligencia/leads",
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
    "/inteligencia/leads",
    "/comercial",
    "/comercial/leads",
    "/comercial/assinaturas",
    "/whatsapp",
    "/dashboards",
    "/configuracoes",
  ],
  financeiro: [
    "/hoje",
    "/casos/financeiro",
    "/relatorio-financeiro",
    "/clientes",
    "/dashboards",
    "/configuracoes",
  ],
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

// ============================================================================
// R3-01 — Permissão EFETIVA por MÓDULO (infra aditiva, regressão zero).
// ----------------------------------------------------------------------------
// Camada NOVA que combina o PAPEL (base, derivada de ROLE_NAV/ROLE_CAPABILITIES)
// com OVERRIDES opcionais por usuário×módulo (`none`/`view`/`edit`). Enquanto não
// houver override, `permissaoEfetiva` reproduz EXATAMENTE o comportamento de
// `can`/`canSeeRoute` (provado por teste de tabela — ver rbac.test.ts / AC-4).
// Nada aqui remove/altera as funções acima: R3-02/R3-03 migram os call-sites
// incrementalmente.
// ============================================================================

/** Módulos canônicos do sistema (doc-mestre §4.3). */
export const MODULES = [
  "comercial",
  "operacional",
  "financeiro",
  "controladoria",
  "inteligencia",
  "marketing",
  "sistema", // config + permissões
] as const;

export type Module = (typeof MODULES)[number];

/** Nível de acesso a um módulo. Ordem crescente: none < view < edit. */
export type ModuleAccess = "none" | "view" | "edit";

/** Ação verificada num módulo. `edit` implica `view`. */
export type ModuleAction = "view" | "edit";

export const MODULE_LABELS: Record<Module, string> = {
  comercial: "Comercial",
  operacional: "Operacional",
  financeiro: "Financeiro",
  controladoria: "Controladoria",
  inteligencia: "Inteligência",
  marketing: "Marketing",
  sistema: "Sistema",
};

// ---------------------------------------------------------------------------
// Derivação base papel→módulo→acesso (espelha ROLE_NAV/ROLE_CAPABILITIES).
//
// Correspondência ROTA↔MÓDULO (fonte: ROLE_NAV) — usada para o nível `view`:
//   comercial      → /comercial, /comercial/leads, /comercial/funil,
//                    /comercial/assinaturas, /whatsapp
//   operacional    → /casos, /pipeline
//   financeiro     → /casos/financeiro, /relatorio-financeiro
//   controladoria  → /controladoria
//   inteligencia   → /inteligencia/leads
//   marketing      → /marketing
//   sistema        → /configuracoes, /permissoes (admin)
//
// Correspondência CAPABILITY↔MÓDULO (fonte: ROLE_CAPABILITIES) — nível `edit`:
//   comercial      → clientes.manage
//   operacional    → casos.manage
//   financeiro     → financeiro.manage
//   controladoria  → casos.manage
//   inteligencia   → (sem cap dedicada hoje ⇒ edit = view)
//   marketing      → (sem cap dedicada hoje ⇒ edit = view)
//   sistema        → config.manage / usuarios.manage
//
// Regra de derivação, para cada (papel, módulo):
//   - `view` se o papel enxerga QUALQUER rota do módulo (canSeeRoute) — ou nav="all".
//   - `edit` se, ALÉM do view, o papel tem a capability de edição do módulo (can).
//   - módulos sem cap dedicada (inteligencia/marketing): edit = view (não há gate
//     de escrita mais estrito hoje; espelhar `can` seria impossível pois não existe).
//   - `none` se o papel não enxerga nenhuma rota do módulo.
// ---------------------------------------------------------------------------

// Rota REPRESENTATIVA de cada módulo (a primeira que aparece em ROLE_NAV). Serve
// para derivar `view` via canSeeRoute e para o teste de regressão.
const MODULE_VIEW_ROUTE: Record<Module, string> = {
  comercial: "/comercial",
  operacional: "/casos",
  financeiro: "/casos/financeiro",
  controladoria: "/controladoria",
  inteligencia: "/inteligencia/leads",
  marketing: "/marketing",
  sistema: "/configuracoes",
};

// Capability de EDIÇÃO de cada módulo (null ⇒ sem cap dedicada; edit = view).
const MODULE_EDIT_CAP: Record<Module, Capability | null> = {
  comercial: "clientes.manage",
  operacional: "casos.manage",
  financeiro: "financeiro.manage",
  controladoria: "casos.manage",
  inteligencia: null,
  marketing: null,
  sistema: "config.manage",
};

function deriveRoleModuleAccess(role: Role, module: Module): ModuleAccess {
  const canView = canSeeRoute(role, MODULE_VIEW_ROUTE[module]);
  if (!canView) return "none";
  const editCap = MODULE_EDIT_CAP[module];
  if (editCap === null) return "edit"; // sem gate de escrita separado ⇒ view == edit
  return can(role, editCap) ? "edit" : "view";
}

/**
 * Mapa base papel→módulo→acesso, derivado de ROLE_NAV/ROLE_CAPABILITIES.
 * É a FONTE ÚNICA da permissão base por módulo. Congelado no load do módulo.
 */
export const ROLE_MODULE_ACCESS: Record<Role, Record<Module, ModuleAccess>> = Object.fromEntries(
  ROLES.map((role) => [
    role,
    Object.fromEntries(MODULES.map((m) => [m, deriveRoleModuleAccess(role, m)])) as Record<
      Module,
      ModuleAccess
    >,
  ]),
) as Record<Role, Record<Module, ModuleAccess>>;

// ---------------------------------------------------------------------------
// Régua BASE do módulo `financeiro` — decisão do dono (2026-07-18), épico R4.
//
// O `financeiro` é a PRIMEIRA aba com régua de NEGÓCIO própria, MAIS restrita
// que a navegação atual (ROLE_NAV). Como advogados têm `/casos/financeiro` no
// NAV, a derivação padrão lhes daria `financeiro:view` — o que vazaria os
// valores $ do cliente. A régua correta para o módulo que expõe dinheiro é:
//   - só `admin` e `financeiro` acessam por padrão (edit);
//   - TODOS os demais papéis = `none` (não veem $).
// Quem precisar recebe OVERRIDE por usuário (`view`/`edit`) via
// `system_user_module_perms`, que `permissaoEfetiva` aplica com precedência
// total sobre a régua base. Sobrescrevemos APENAS o módulo `financeiro`; os
// demais continuam espelhando o NAV/capabilities (regressão zero preservada).
// ---------------------------------------------------------------------------
for (const role of ROLES) {
  ROLE_MODULE_ACCESS[role].financeiro = role === "admin" || role === "financeiro" ? "edit" : "none";
}

/** `true` se o nível de acesso `access` cobre a ação `action` (edit ⊇ view). */
function accessAllows(access: ModuleAccess, action: ModuleAction): boolean {
  if (access === "none") return false;
  if (action === "view") return true; // view e edit permitem ver
  return access === "edit"; // só edit permite editar
}

/**
 * Permissão EFETIVA de um usuário sobre um módulo/ação — FONTE ÚNICA (R3-01).
 *
 * Precedência: **override > papel**.
 *  - Se existe override para o módulo → decide SÓ pelo override.
 *  - Se não existe → cai no mapa base do papel (regressão zero).
 *  - `role` nulo/desconhecido ⇒ `false` (mesma postura de `can`/`canSeeRoute`).
 *
 * Função PURA: os overrides já vêm carregados (sem I/O) para ser testável e
 * usável tanto no client quanto no server.
 *
 * @param role      papel do usuário (`system_users.role`).
 * @param overrides overrides do usuário (`{ [module]: access }`) — pode ser vazio.
 * @param module    módulo consultado.
 * @param action    ação (`view`/`edit`).
 */
export function permissaoEfetiva(
  role: Role | null | undefined,
  overrides: Partial<Record<Module, ModuleAccess>> | null | undefined,
  module: Module,
  action: ModuleAction,
): boolean {
  if (!role) return false;
  const override = overrides?.[module];
  if (override !== undefined) {
    // Override tem precedência total — ignora o papel (aditivo p/ ambos lados).
    return accessAllows(override, action);
  }
  // Sem override: cai no papel (comportamento atual, AC-4).
  return accessAllows(ROLE_MODULE_ACCESS[role][module], action);
}

// Fase B (2026-07-19) — módulos que EXIBEM valores em R$ e, portanto, têm a chave
// "ver valores" no editor de permissões. Hoje TODO valor do sistema (financeiro,
// painel financeiro do cadastro do cliente, valor do caso na Lista) é gateado pelo
// módulo `financeiro`; `controladoria` entra quando ganhar valores. Amplie aqui.
export const MODULE_HAS_VALUES: Partial<Record<Module, boolean>> = {
  financeiro: true,
  controladoria: true,
};

/**
 * O usuário pode VER VALORES (R$) no módulo? (Fase B, chave "ver valores".)
 *
 * Precedência:
 *  1. Se há override EXPLÍCITO da chave de valores (`valueOverrides[module]` =
 *     true/false) → decide só por ele (o admin ligou/desligou na mão).
 *  2. Senão → PADRÃO: vê valores se tem acesso efetivo (view+) ao módulo, via
 *     `permissaoEfetiva` (papel + overrides de acesso). Isso REPRODUZ exatamente
 *     o gate atual (`permissaoEfetiva(role, perms, 'financeiro', 'view')`) —
 *     enquanto ninguém setar a chave, o comportamento é idêntico (regressão zero).
 *
 * @param valueOverrides overrides da chave de valores por módulo (`{ [module]: boolean }`).
 */
export function podeVerValores(
  role: Role | null | undefined,
  moduleOverrides: Partial<Record<Module, ModuleAccess>> | null | undefined,
  valueOverrides: Partial<Record<Module, boolean>> | null | undefined,
  module: Module = "financeiro",
): boolean {
  if (!role) return false;
  const ov = valueOverrides?.[module];
  if (ov !== undefined) return ov;
  return permissaoEfetiva(role, moduleOverrides, module, "view");
}

// Fase B/Sidebar (2026-07-19) — mapa de cada rota do MENU → MÓDULO. Serve para o
// menu respeitar os overrides por aba (permissaoEfetiva), não só o papel base.
// Rotas sem módulo (ex.: /hoje) caem em `canSeeRoute` (papel).
export const ROUTE_MODULE: Partial<Record<string, Module>> = {
  "/pipeline": "operacional",
  "/casos": "operacional",
  "/casos/financeiro": "financeiro",
  "/relatorio-financeiro": "financeiro",
  "/clientes": "operacional",
  "/comercial/assinaturas": "comercial",
  "/tarefas": "operacional",
  "/inteligencia/leads": "comercial",
  "/comercial": "comercial",
  "/comercial/leads": "comercial",
  "/controladoria": "controladoria",
  "/peticionamento": "inteligencia",
  "/whatsapp": "comercial",
  "/dashboards": "inteligencia",
  "/marketing": "marketing",
  "/design-system": "sistema",
  "/referencias": "sistema",
  "/permissoes": "sistema",
  "/configuracoes": "sistema",
  // I1 (2026-08-05) — tela dedicada de campos personalizados (config do sistema).
  "/configuracoes/campos-personalizados": "sistema",
};

/**
 * O usuário pode VER a rota `to` no menu, considerando os OVERRIDES por módulo?
 * Se a rota tem módulo mapeado → decide por `permissaoEfetiva(module, 'view')`
 * (respeita não-ver/visualizar/editar). Se não tem módulo (ex.: /hoje) → cai no
 * papel base (`canSeeRoute`). É o gate que o Sidebar deve usar (não `canSeeRoute`).
 */
export function canSeeRouteEfetiva(
  role: Role | null | undefined,
  overrides: Partial<Record<Module, ModuleAccess>> | null | undefined,
  to: string,
): boolean {
  if (!role) return false;
  const module = ROUTE_MODULE[to];
  if (!module) return canSeeRoute(role, to);
  return permissaoEfetiva(role, overrides, module, "view");
}
