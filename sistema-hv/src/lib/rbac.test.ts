// Testes leves rodando como script standalone (npx tsx). Sem runner, SEM banco.
// Falha = stderr + exit 1. Cobre R3-01 AC-4 (regressão zero) + overrides + null.

import {
  ROLES,
  MODULES,
  can,
  canSeeRoute,
  permissaoEfetiva,
  ROLE_MODULE_ACCESS,
  type Module,
  type ModuleAccess,
  type ModuleAction,
  type Role,
} from "./rbac";

let failed = 0;

function assert(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Oráculo INDEPENDENTE do comportamento atual, calculado direto de
// can()/canSeeRoute() — NÃO usa ROLE_MODULE_ACCESS. Se `permissaoEfetiva` (sem
// override) bater com este oráculo p/ os 9 papéis, provamos regressão zero.
// ---------------------------------------------------------------------------
const MODULE_VIEW_ROUTE: Record<Module, string> = {
  comercial: "/comercial",
  operacional: "/casos",
  financeiro: "/casos/financeiro",
  controladoria: "/controladoria",
  inteligencia: "/inteligencia/leads",
  marketing: "/marketing",
  sistema: "/configuracoes",
};

const MODULE_EDIT_CAP = {
  comercial: "clientes.manage",
  operacional: "casos.manage",
  financeiro: "financeiro.manage",
  controladoria: "casos.manage",
  inteligencia: null,
  marketing: null,
  sistema: "config.manage",
} as const;

function oracle(role: Role, module: Module, action: ModuleAction): boolean {
  const canView = canSeeRoute(role, MODULE_VIEW_ROUTE[module]);
  if (!canView) return false; // sem view ⇒ nega tudo
  if (action === "view") return true; // enxerga a rota ⇒ pode ver
  const cap = MODULE_EDIT_CAP[module];
  if (cap === null) return true; // sem gate de escrita separado ⇒ edit == view
  return can(role, cap); // edit = ter a capability do módulo
}

// ---------------------------------------------------------------------------
// AC-4 — Regressão zero: tabela papel×módulo×ação (9×7×2 = 126 combinações).
// SEM override, permissaoEfetiva == comportamento de can/canSeeRoute — EXCETO o
// módulo `financeiro`, que ganhou régua de NEGÓCIO própria por decisão do dono
// (2026-07-18, épico R4): só admin+financeiro por padrão; demais papéis `none`.
// Essa aba deixou de espelhar o NAV de propósito (não é regressão) e por isso é
// EXCLUÍDA do laço de equivalência com o oráculo; ela é coberta por casos
// explícitos logo abaixo ("Régua base do módulo financeiro").
// ---------------------------------------------------------------------------
console.log("AC-4 — Regressão zero (9 papéis × 6 módulos × 2 ações, financeiro é exceção)");
const actions: ModuleAction[] = ["view", "edit"];
// financeiro tem régua de negócio própria (ver bloco dedicado) ⇒ não espelha o NAV.
const NAV_MIRRORED_MODULES = MODULES.filter((m) => m !== "financeiro");
let regressionCount = 0;
for (const role of ROLES) {
  for (const module of NAV_MIRRORED_MODULES) {
    for (const action of actions) {
      const efetiva = permissaoEfetiva(role, {}, module, action);
      const esperado = oracle(role, module, action);
      regressionCount++;
      if (efetiva !== esperado) {
        assert(`${role} / ${module} / ${action} == oráculo(${esperado})`, false);
      }
    }
  }
}
assert(`todas as ${regressionCount} combinações batem com can/canSeeRoute`, failed === 0);
assert("cobriu exatamente 108 combinações (9×6×2, financeiro excluído)", regressionCount === 108);

// ---------------------------------------------------------------------------
// Régua BASE do módulo `financeiro` — decisão do dono (2026-07-18, R4).
// Só admin+financeiro acessam por padrão; demais papéis `none` (não veem $).
// Overrides por usuário liberam via permissaoEfetiva (precedência total).
// ---------------------------------------------------------------------------
console.log("\nRégua base do módulo financeiro (admin+financeiro; demais none)");
assert(
  "admin: financeiro/view == true",
  permissaoEfetiva("admin", {}, "financeiro", "view") === true,
);
assert(
  "admin: financeiro/edit == true",
  permissaoEfetiva("admin", {}, "financeiro", "edit") === true,
);
assert(
  "financeiro: financeiro/edit == true",
  permissaoEfetiva("financeiro", {}, "financeiro", "edit") === true,
);
assert(
  "advogado_titular: financeiro/view == false (régua de negócio, não NAV)",
  permissaoEfetiva("advogado_titular", {}, "financeiro", "view") === false,
);
assert(
  "advogado_associado: financeiro/view == false (régua de negócio, não NAV)",
  permissaoEfetiva("advogado_associado", {}, "financeiro", "view") === false,
);
assert(
  "operacional: financeiro/view == false",
  permissaoEfetiva("operacional", {}, "financeiro", "view") === false,
);
assert(
  "override view libera ver: operacional {financeiro:view} /view == true",
  permissaoEfetiva("operacional", { financeiro: "view" }, "financeiro", "view") === true,
);
assert(
  "override view NÃO libera editar: operacional {financeiro:view} /edit == false",
  permissaoEfetiva("operacional", { financeiro: "view" }, "financeiro", "edit") === false,
);
assert(
  "override edit libera editar: advogado_associado {financeiro:edit} /edit == true",
  permissaoEfetiva("advogado_associado", { financeiro: "edit" }, "financeiro", "edit") === true,
);

// undefined overrides também caem no papel (mesmo resultado) — módulos que
// espelham o NAV (financeiro é exceção, coberto por casos explícitos acima).
{
  let allMatch = true;
  for (const role of ROLES) {
    for (const module of NAV_MIRRORED_MODULES) {
      for (const action of actions) {
        if (permissaoEfetiva(role, undefined, module, action) !== oracle(role, module, action)) {
          allMatch = false;
        }
      }
    }
  }
  assert("overrides=undefined ⇒ idêntico ao papel", allMatch);
}

// ---------------------------------------------------------------------------
// Overrides — precedência override > papel (aditivo nos dois sentidos).
// ---------------------------------------------------------------------------
console.log("\nOverrides (precedência sobre o papel)");

// none bloqueia módulo que o papel liberava (admin vê financeiro por régua base).
assert("admin base: financeiro/view == true", permissaoEfetiva("admin", {}, "financeiro", "view"));
assert(
  "override none ⇒ financeiro/view == false (mesmo com papel liberando)",
  permissaoEfetiva("admin", { financeiro: "none" }, "financeiro", "view") === false,
);
assert(
  "override none ⇒ financeiro/edit == false",
  permissaoEfetiva("admin", { financeiro: "none" }, "financeiro", "edit") === false,
);

// view permite ver, nega editar.
assert(
  "override view ⇒ operacional/view == true",
  permissaoEfetiva("marketing", { operacional: "view" }, "operacional", "view") === true,
);
assert(
  "override view ⇒ operacional/edit == false",
  permissaoEfetiva("marketing", { operacional: "view" }, "operacional", "edit") === false,
);

// edit num módulo que o papel NÃO teria (marketing não vê financeiro) ⇒ libera (aditivo).
assert(
  "marketing base: financeiro/view == false",
  permissaoEfetiva("marketing", {}, "financeiro", "view") === false,
);
assert(
  "override edit ⇒ financeiro/view == true (aditivo)",
  permissaoEfetiva("marketing", { financeiro: "edit" }, "financeiro", "view") === true,
);
assert(
  "override edit ⇒ financeiro/edit == true (aditivo)",
  permissaoEfetiva("marketing", { financeiro: "edit" }, "financeiro", "edit") === true,
);

// Override em um módulo NÃO afeta os demais (isolamento).
assert(
  "override só afeta o módulo alvo (comercial intacto)",
  permissaoEfetiva("comercial", { financeiro: "edit" }, "comercial", "edit") ===
    permissaoEfetiva("comercial", {}, "comercial", "edit"),
);

// ---------------------------------------------------------------------------
// Postura defensiva — role nulo/indefinido ⇒ false (igual can/canSeeRoute).
// ---------------------------------------------------------------------------
console.log("\nPostura defensiva (role nulo)");
assert("role null ⇒ false", permissaoEfetiva(null, {}, "operacional", "view") === false);
assert(
  "role undefined ⇒ false",
  permissaoEfetiva(undefined, { operacional: "edit" }, "operacional", "edit") === false,
);
assert(
  "role null com override edit ⇒ ainda false (defensivo)",
  permissaoEfetiva(null, { financeiro: "edit" }, "financeiro", "view") === false,
);

// ---------------------------------------------------------------------------
// Sanidade do mapa base — admin é edit em todos; forma bem definida.
// ---------------------------------------------------------------------------
console.log("\nSanidade de ROLE_MODULE_ACCESS");
{
  const adminAllEdit = MODULES.every((m) => ROLE_MODULE_ACCESS.admin[m] === "edit");
  assert("admin: edit em todos os módulos", adminAllEdit);

  const valores: ModuleAccess[] = ["none", "view", "edit"];
  let bemFormado = true;
  for (const role of ROLES) {
    for (const m of MODULES) {
      if (!valores.includes(ROLE_MODULE_ACCESS[role][m])) bemFormado = false;
    }
  }
  assert("todos os valores em {none,view,edit}", bemFormado);
}

console.log();
if (failed > 0) {
  console.error(`❌ ${failed} teste(s) falhou(aram).`);
  process.exit(1);
}
console.log("🎉 Todos os testes passaram.");
