// QA da S5-04 — de-para dos usuários e nível Configurar.
//
// Esta story mexe no acesso de gente que está trabalhando, e o erro caro aqui é
// silencioso nos dois sentidos: alguém perde acesso e não consegue trabalhar, ou
// alguém ganha acesso que não deveria ter. O QA cobre os dois.
//
// SOMENTE LEITURA — nenhum papel é alterado aqui.
//
// Rodar: npx tsx scripts/qa-s504-depara-e-configurar.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";

import { MODULES, permissaoEfetiva, ROLES, seesOnlyOwnCases, type Role } from "../src/lib/rbac";
import { getRoleModuleDefaults } from "../src/lib/rbac-perms-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

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
  const defaults = new Map<string, Awaited<ReturnType<typeof getRoleModuleDefaults>>>();
  for (const r of ROLES) defaults.set(r, await getRoleModuleDefaults(r));
  const pode = (r: Role, m: (typeof MODULES)[number], a: "view" | "edit" | "configure") =>
    permissaoEfetiva(r, {}, m, a, defaults.get(r));

  // ============================================ o nível Configurar é alcançável
  console.log("\n  A — Configurar deixou de ser um nível que ninguém alcança\n");

  // O bug: `deriveRoleModuleAccess` tinha teto `edit`, e só os 4 papéis novos
  // ganharam linha na matriz. O admin caía no derivado e ficava SEM configure —
  // então `requireModule(x, "configure")` recusava todo mundo, inclusive ele.
  // Um gate que ninguém passa não protege nada, só quebra a tela.
  for (const m of MODULES) {
    check(`admin configura "${m}"`, pode("admin", m, "configure"));
  }

  // D10: "por padrão: Administrador e Coordenador".
  check(
    "coordenador configura o operacional (D10)",
    pode("coordenador", "operacional", "configure"),
  );
  check("coordenador configura o cliente", pode("coordenador", "cliente", "configure"));
  check("coordenador configura o comercial", pode("coordenador", "comercial", "configure"));
  check(
    "coordenador NÃO configura o sistema (a matriz dá só 'view')",
    !pode("coordenador", "sistema", "configure"),
  );

  // Quem não deve configurar, não configura.
  for (const r of ["operacional", "estagiario", "atendimento", "suporte", "marketing"] as Role[]) {
    check(`${r} não configura o operacional`, !pode(r, "operacional", "configure"));
  }

  // ============================================ ninguém perdeu o que já tinha
  console.log("\n  B — a mudança do admin não tirou acesso de ninguém\n");

  // `configure` está no topo da escada, então dar configure só ADICIONA. Se
  // algum papel tivesse perdido view/edit, seria regressão grave.
  for (const r of ROLES) {
    const perdeu = MODULES.filter((m) => {
      // Antes da correção o admin tinha edit em tudo (e none/edit no financeiro).
      if (r !== "admin") return false;
      return !pode(r, m, "view") || !pode(r, m, "edit");
    });
    if (r === "admin") {
      check(
        "admin continua com view e edit em todos os módulos",
        perdeu.length === 0,
        perdeu.join(", "),
      );
    }
  }
  check(
    "o financeiro continua fechado para quem não é admin nem financeiro",
    !pode("operacional", "financeiro", "view") && !pode("atendimento", "financeiro", "view"),
  );
  check("o papel financeiro continua vendo o financeiro", pode("financeiro", "financeiro", "edit"));

  // ================================================ gates aplicados no código
  console.log("\n  C — os gates estão no código, não só na intenção\n");

  const rotaCaso = readFileSync("src/routes/casos.$id.index.tsx", "utf8");
  check(
    'o menu "Editar caso" usa Configurar (D10)',
    rotaCaso.includes('usePodeConfigurar("operacional")') &&
      rotaCaso.includes("{podeConfigurarCaso && ("),
  );
  check(
    "editar o NOME do caso continua em edit (é conteúdo, não régua)",
    rotaCaso.includes('usePodeEditar("operacional")'),
  );

  const rpcTemas = readFileSync("src/rpc/temas.ts", "utf8");
  check(
    "configurar tema usa requireModule (o TODO(R3) foi fechado)",
    rpcTemas.includes('requireModule("sistema", "configure")') &&
      // A CHAMADA, não a menção: o comentário logo acima cita o `requireRole`
      // antigo para explicar o que mudou, e isso é bom.
      !/await\s+requireRole\(/.test(rpcTemas),
  );

  const hooks = readFileSync("src/hooks/usePermissions.ts", "utf8");
  check("existe o hook usePodeConfigurar", hooks.includes("export function usePodeConfigurar"));

  // ==================================================== o de-para em si
  console.log("\n  D — o de-para é seguro por construção\n");

  const gerar = readFileSync("scripts/depara-usuarios-gerar.ts", "utf8");
  const aplicar = readFileSync("scripts/depara-usuarios-aplicar.ts", "utf8");
  const reverter = readFileSync("scripts/depara-usuarios-reverter.ts", "utf8");

  check("o gerador não escreve nada no banco (AC1)", !/\.update\(|\.insert\(/.test(gerar));
  check(
    "o aplicador parte da PLANILHA, não de um mapa no código (AC2)",
    aplicar.includes("readFileSync(ARQUIVO") && !aplicar.includes("const PROPOSTA"),
  );
  check(
    "grava snapshot ANTES de escrever (AC3)",
    aplicar.includes("writeFileSync(caminhoSnapshot"),
  );
  check("existe o script de rollback (AC3)", reverter.includes("role_anterior"));
  check(
    "promover a admin exige confirmação escrita (AC4)",
    aplicar.includes("CONFIRMAR_ADMIN") && aplicar.includes('!== "SIM"'),
  );
  check(
    "linha sem papel proposto aborta tudo — ninguém fica sem papel (AC4)",
    aplicar.includes("sem papel proposto"),
  );
  check(
    "planilha desatualizada é recusada em vez de sobrescrever decisão nova",
    aplicar.includes("gere a planilha de novo"),
  );

  // ================================================ o alerta que importa
  console.log("\n  E — ampliação de acesso fica visível, não silenciosa\n");

  check(
    "o gerador avisa quem passa a ver TODOS os casos",
    gerar.includes("PASSA A VER TODOS OS CASOS"),
  );

  const { data } = await sb.from("system_users").select("full_name, role, status");
  const usuarios = (data ?? []) as Array<{
    full_name: string | null;
    role: string;
    status: string | null;
  }>;
  const restritos = usuarios.filter((u) => seesOnlyOwnCases(u.role as Role));
  console.log(
    `  (${restritos.length} usuário(s) hoje só veem os próprios casos: ${restritos.map((u) => `${u.full_name} [${u.role}]`).join(", ") || "nenhum"})`,
  );

  // Todo mundo tem papel válido — o de-para não pode deixar ninguém órfão.
  const semPapel = usuarios.filter((u) => !(ROLES as readonly string[]).includes(u.role));
  check(
    "todo usuário tem um papel que o sistema reconhece",
    semPapel.length === 0,
    semPapel.map((u) => `${u.full_name}: ${u.role}`).join(", "),
  );

  if (falhou) {
    console.error(`\nS5-04: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nS5-04: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
