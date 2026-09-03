// QA S5-01 (03/09) — prova, contra o BANCO REAL, que:
//   1. a matriz do Thiago está semeada para os papéis NOVOS;
//   2. papéis EXISTENTES não mudaram de acesso (regressão zero);
//   3. a precedência é override do usuário > padrão do papel > mapa derivado;
//   4. a escada none < view < edit < configure funciona.
//
// Rodar: npx tsx scripts/qa-permissoes-matriz.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { getRoleModuleDefaults } from "../src/lib/rbac-perms-service";
import { permissaoEfetiva, ROLE_MODULE_ACCESS, type Module, type Role } from "../src/lib/rbac";

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

async function main() {
  const sb = getSupabaseAdmin();

  // ---- 1) Seed dos papéis novos -------------------------------------------
  const coordenador = await getRoleModuleDefaults("coordenador");
  check(
    "coordenador: configura o operacional (matriz)",
    coordenador.operacional === "configure",
    coordenador.operacional,
  );
  check(
    "coordenador: edita o financeiro (matriz)",
    coordenador.financeiro === "edit",
    coordenador.financeiro,
  );
  check("coordenador: só VÊ o sistema (matriz)", coordenador.sistema === "view", coordenador.sistema);

  const atendimento = await getRoleModuleDefaults("atendimento");
  check(
    "atendimento: sem financeiro (matriz)",
    atendimento.financeiro === "none",
    atendimento.financeiro,
  );
  check("atendimento: edita cliente (matriz)", atendimento.cliente === "edit", atendimento.cliente);

  // ---- 2) Regressão zero nos papéis EXISTENTES ----------------------------
  const papeisEmUso = ["admin", "operacional", "financeiro", "advogado_titular", "prestador_externo"];
  for (const papel of papeisEmUso) {
    const defaults = await getRoleModuleDefaults(papel);
    check(
      `${papel}: sem linhas na matriz ⇒ cai no mapa derivado`,
      Object.keys(defaults).length === 0,
      `${Object.keys(defaults).length} linha(s)`,
    );
  }

  // Prova de comportamento: para cada papel em uso, a permissão efetiva SEM
  // override tem que ser idêntica ao mapa derivado (nada mudou para eles).
  const modulos: Module[] = [
    "cliente",
    "comercial",
    "operacional",
    "financeiro",
    "controladoria",
    "inteligencia",
    "marketing",
    "sistema",
  ];
  let divergencias = 0;
  for (const papel of papeisEmUso) {
    const defaults = await getRoleModuleDefaults(papel);
    for (const m of modulos) {
      for (const acao of ["view", "edit"] as const) {
        const efetiva = permissaoEfetiva(papel as Role, {}, m, acao, defaults);
        const derivada = permissaoEfetiva(papel as Role, {}, m, acao);
        if (efetiva !== derivada) divergencias++;
      }
    }
  }
  check(
    `nenhum papel em uso mudou de acesso (${papeisEmUso.length} papéis × ${modulos.length} módulos × 2 ações)`,
    divergencias === 0,
    `${divergencias} divergência(s)`,
  );

  // ---- 3) Precedência ------------------------------------------------------
  const coordDefaults = await getRoleModuleDefaults("coordenador");
  check(
    "override do usuário vence o padrão do papel",
    permissaoEfetiva("coordenador" as Role, { financeiro: "none" }, "financeiro", "view", coordDefaults) ===
      false,
  );
  check(
    "sem override, vale o padrão do papel",
    permissaoEfetiva("coordenador" as Role, {}, "financeiro", "view", coordDefaults) === true,
  );

  // ---- 4) Escada de níveis -------------------------------------------------
  check(
    "configure cobre edit",
    permissaoEfetiva("coordenador" as Role, {}, "operacional", "edit", coordDefaults) === true,
  );
  check(
    "edit NÃO cobre configure",
    permissaoEfetiva("coordenador" as Role, {}, "financeiro", "configure", coordDefaults) === false,
  );
  check(
    "view não cobre edit",
    permissaoEfetiva("coordenador" as Role, {}, "sistema", "edit", coordDefaults) === false,
  );

  // ---- 5) Integridade dos usuários ----------------------------------------
  const { data: usuarios } = await sb
    .from("system_users")
    .select("id, role")
    .is("deleted_at", null);
  const semPapelConhecido = (usuarios ?? []).filter(
    (u) => !(u.role as string) || !(u.role in ROLE_MODULE_ACCESS),
  );
  check(
    `todos os ${usuarios?.length ?? 0} usuários têm papel reconhecido pelo rbac`,
    semPapelConhecido.length === 0,
    JSON.stringify(semPapelConhecido.slice(0, 3)),
  );

  if (falhou) {
    console.error(`\nPERMISSÕES: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nPERMISSÕES: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
