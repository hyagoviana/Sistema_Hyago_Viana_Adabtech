"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/rbac.ts
var rbac_exports = {};
__export(rbac_exports, {
  MODULES: () => MODULES,
  MODULE_LABELS: () => MODULE_LABELS,
  ROLES: () => ROLES,
  ROLE_DESCRIPTIONS: () => ROLE_DESCRIPTIONS,
  ROLE_LABELS: () => ROLE_LABELS,
  ROLE_MODULE_ACCESS: () => ROLE_MODULE_ACCESS,
  can: () => can,
  canSeeRoute: () => canSeeRoute,
  isAdvogado: () => isAdvogado,
  permissaoEfetiva: () => permissaoEfetiva,
  seesOnlyOwnCases: () => seesOnlyOwnCases
});
module.exports = __toCommonJS(rbac_exports);
var ROLES = [
  "admin",
  "advogado_titular",
  "advogado_associado",
  "prestador_externo",
  "controladoria",
  "comercial",
  "financeiro",
  "operacional",
  "marketing"
];
var ROLE_LABELS = {
  admin: "Administrador",
  advogado_titular: "Advogado Titular",
  advogado_associado: "Advogado Associado",
  prestador_externo: "Prestador Externo",
  controladoria: "Controladoria",
  comercial: "Comercial",
  financeiro: "Financeiro",
  operacional: "Operacional",
  marketing: "Marketing"
};
var ROLE_DESCRIPTIONS = {
  admin: "Acesso total ao sistema, incluindo gest\xE3o de usu\xE1rios e configura\xE7\xF5es.",
  advogado_titular: "Vis\xE3o completa de casos, clientes, financeiro e intelig\xEAncia.",
  advogado_associado: "Casos, clientes, prazos e peticionamento. Sem gest\xE3o de usu\xE1rios.",
  prestador_externo: "Acesso restrito aos casos e tarefas atribu\xEDdos.",
  controladoria: "Casos, prazos e controladoria. Foco em conformidade processual.",
  comercial: "Clientes, funil comercial e atendimento (WhatsApp).",
  financeiro: "Pipeline financeira, cobran\xE7as e inadimpl\xEAncia.",
  operacional: "Casos operacionais, clientes e tarefas do dia a dia.",
  marketing: "Marketing e dashboards de performance."
};
var ALL_CAPS = [
  "clientes.manage",
  "casos.manage",
  "financeiro.manage",
  "documentos.upload",
  "dossie.manage",
  "usuarios.manage",
  "config.manage"
];
var ROLE_CAPABILITIES = {
  admin: ALL_CAPS,
  advogado_titular: [
    "clientes.manage",
    "casos.manage",
    "financeiro.manage",
    "documentos.upload",
    "dossie.manage"
  ],
  advogado_associado: ["clientes.manage", "casos.manage", "documentos.upload", "dossie.manage"],
  prestador_externo: ["documentos.upload", "dossie.manage"],
  controladoria: ["casos.manage", "dossie.manage"],
  comercial: ["clientes.manage"],
  financeiro: ["financeiro.manage"],
  operacional: ["clientes.manage", "casos.manage", "documentos.upload", "dossie.manage"],
  marketing: []
};
function can(role, cap) {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}
var OWN_CASES_ONLY_ROLES = [
  "advogado_titular",
  "advogado_associado",
  "prestador_externo"
];
function seesOnlyOwnCases(role) {
  if (!role) return false;
  return OWN_CASES_ONLY_ROLES.includes(role);
}
function isAdvogado(role) {
  return role === "advogado_titular" || role === "advogado_associado";
}
var ROLE_NAV = {
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
    "/configuracoes"
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
    "/configuracoes"
  ],
  financeiro: [
    "/hoje",
    "/casos/financeiro",
    "/relatorio-financeiro",
    "/clientes",
    "/dashboards",
    "/configuracoes"
  ],
  operacional: ["/hoje", "/casos", "/pipeline", "/clientes", "/tarefas", "/configuracoes"],
  marketing: ["/hoje", "/marketing", "/dashboards", "/configuracoes"]
};
function canSeeRoute(role, to) {
  if (!role) return false;
  const nav = ROLE_NAV[role];
  if (nav === "all") return true;
  return nav.includes(to);
}
var MODULES = [
  "comercial",
  "operacional",
  "financeiro",
  "controladoria",
  "inteligencia",
  "marketing",
  "sistema"
  // config + permissões
];
var MODULE_LABELS = {
  comercial: "Comercial",
  operacional: "Operacional",
  financeiro: "Financeiro",
  controladoria: "Controladoria",
  inteligencia: "Intelig\xEAncia",
  marketing: "Marketing",
  sistema: "Sistema"
};
var MODULE_VIEW_ROUTE = {
  comercial: "/comercial",
  operacional: "/casos",
  financeiro: "/casos/financeiro",
  controladoria: "/controladoria",
  inteligencia: "/inteligencia/leads",
  marketing: "/marketing",
  sistema: "/configuracoes"
};
var MODULE_EDIT_CAP = {
  comercial: "clientes.manage",
  operacional: "casos.manage",
  financeiro: "financeiro.manage",
  controladoria: "casos.manage",
  inteligencia: null,
  marketing: null,
  sistema: "config.manage"
};
function deriveRoleModuleAccess(role, module2) {
  const canView = canSeeRoute(role, MODULE_VIEW_ROUTE[module2]);
  if (!canView) return "none";
  const editCap = MODULE_EDIT_CAP[module2];
  if (editCap === null) return "edit";
  return can(role, editCap) ? "edit" : "view";
}
var ROLE_MODULE_ACCESS = Object.fromEntries(
  ROLES.map((role) => [
    role,
    Object.fromEntries(MODULES.map((m) => [m, deriveRoleModuleAccess(role, m)]))
  ])
);
function accessAllows(access, action) {
  if (access === "none") return false;
  if (action === "view") return true;
  return access === "edit";
}
function permissaoEfetiva(role, overrides, module2, action) {
  if (!role) return false;
  const override = overrides?.[module2];
  if (override !== void 0) {
    return accessAllows(override, action);
  }
  return accessAllows(ROLE_MODULE_ACCESS[role][module2], action);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MODULES,
  MODULE_LABELS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_MODULE_ACCESS,
  can,
  canSeeRoute,
  isAdvogado,
  permissaoEfetiva,
  seesOnlyOwnCases
});
