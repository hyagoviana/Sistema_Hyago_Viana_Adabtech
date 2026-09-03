// QA S5-02 (03/09) — a tela de padrão por PAPEL grava e apaga de verdade?
//
// Exercita o serviço contra o BANCO REAL num papel de teste que NÃO existe no
// sistema (`__qa_papel_teste__`), para não tocar em nenhum papel em uso. Limpa
// tudo no `finally`.
//
// Rodar: npx tsx scripts/qa-role-perms-matriz.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  getRoleModuleDefaults,
  listRoleModulePerms,
  setRoleModulePerms,
} from "../src/lib/rbac-perms-service";
import { permissaoEfetiva, type Role } from "../src/lib/rbac";

const PAPEL_TESTE = "__qa_papel_teste__";

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

async function main() {
  try {
    // ---- leitura da matriz -------------------------------------------------
    const antes = await listRoleModulePerms();
    const papeisSemeados = [...new Set(antes.map((l) => l.role))].sort();
    check(
      `matriz lê os papéis semeados (${papeisSemeados.join(", ")})`,
      papeisSemeados.length === 4,
      `${papeisSemeados.length} papel(is)`,
    );

    // ---- gravar ------------------------------------------------------------
    await setRoleModulePerms(PAPEL_TESTE, { operacional: "configure", financeiro: "view" });
    const gravado = await getRoleModuleDefaults(PAPEL_TESTE);
    check("gravou o padrão do papel", gravado.operacional === "configure", gravado.operacional);
    check("gravou a segunda célula", gravado.financeiro === "view", gravado.financeiro);

    // ---- cache invalidado --------------------------------------------------
    await setRoleModulePerms(PAPEL_TESTE, { operacional: "view" });
    const regravado = await getRoleModuleDefaults(PAPEL_TESTE);
    check(
      "regravar reflete na hora (cache invalidado)",
      regravado.operacional === "view",
      regravado.operacional,
    );

    // ---- a régua vale de fato ---------------------------------------------
    check(
      "com padrão 'view', o papel NÃO edita",
      permissaoEfetiva(PAPEL_TESTE as Role, {}, "operacional", "edit", regravado) === false,
    );
    check(
      "com padrão 'view', o papel VÊ",
      permissaoEfetiva(PAPEL_TESTE as Role, {}, "operacional", "view", regravado) === true,
    );
    check(
      "override do usuário ainda vence o padrão do papel",
      permissaoEfetiva(
        PAPEL_TESTE as Role,
        { operacional: "configure" },
        "operacional",
        "configure",
        regravado,
      ) === true,
    );

    // ---- voltar ao "padrão do sistema" (null apaga a linha) ----------------
    await setRoleModulePerms(PAPEL_TESTE, { operacional: null, financeiro: null });
    const limpo = await getRoleModuleDefaults(PAPEL_TESTE);
    check(
      "null remove a linha (volta ao padrão do sistema)",
      Object.keys(limpo).length === 0,
      JSON.stringify(limpo),
    );

    // ---- os papéis REAIS não foram tocados --------------------------------
    const depois = await listRoleModulePerms();
    check(
      `nenhuma linha dos papéis reais mudou (${antes.length} antes, ${depois.length} depois)`,
      antes.length === depois.length,
    );
  } finally {
    await setRoleModulePerms(PAPEL_TESTE, {
      cliente: null,
      comercial: null,
      operacional: null,
      financeiro: null,
      controladoria: null,
      inteligencia: null,
      marketing: null,
      sistema: null,
      judicial: null,
    });
    const sobrou = await getRoleModuleDefaults(PAPEL_TESTE);
    console.log(
      `\n  ↩ papel de teste limpo — ${Object.keys(sobrou).length} linha(s) restante(s) (esperado: 0)`,
    );
    if (Object.keys(sobrou).length > 0) falhou++;
  }

  if (falhou) {
    console.error(`\nMATRIZ POR PAPEL: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nMATRIZ POR PAPEL: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
