// QA da S4-01 — o menu "Editar caso".
//
// O menu decide QUEM configura o caso: tema, urgência e responsável. Um item que
// sobra ali (ou some) muda o que cada papel consegue fazer sem ninguém perceber.
//
// Rodar: npx tsx scripts/qa-s401-menu-editar-caso.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

const ficha = readFileSync("src/routes/casos.$id.index.tsx", "utf8");
const dialog = readFileSync("src/components/cases/CaseResponsavelDialog.tsx", "utf8");
const rpc = readFileSync("src/rpc/cases.ts", "utf8");

console.log("\n  A — as três ações do menu\n");

check("Mudar tema / tipo", ficha.includes("Mudar tema / tipo (pipeline)"));
check("Mudar responsável", ficha.includes("Mudar responsável"));
check("Mudar urgência", ficha.includes("Urgência (motor de distribuição)"));

// AC2 — "Preencher campos" sai do menu: os campos são editados no painel da
// própria página, e duas portas para a mesma edição faziam o menu de
// configuração parecer o lugar de mexer em conteúdo.
check(
  'a ação "Preencher campos" saiu do menu',
  // O ITEM, não a menção: o comentário logo acima explica por que ele saiu, e
  // isso é bom. O sinal de que sumiu de verdade é não haver mais o
  // `DropdownMenuItem` nem o estado que o abria.
  !/<DropdownMenuItem[^>]*>[\s\S]{0,120}Preencher campos/.test(ficha) &&
    !ficha.includes("setFillFiltersOpen"),
);
// Mas o diálogo continua onde resolve um problema real: antes de gerar o Word.
const gerar = readFileSync("src/components/cases/GenerateCaseDocumentFlow.tsx", "utf8");
const aba = readFileSync("src/components/cases/CaseDocumentsTab.tsx", "utf8");
check(
  "o diálogo de preencher campos continua no fluxo de geração",
  gerar.includes("<CaseFilterFillDialog") && aba.includes("<CaseFilterFillDialog"),
);

console.log("\n  B — o gate\n");

check(
  "o menu inteiro exige Configurar no operacional (D10)",
  ficha.includes("{podeConfigurarCaso && (") && ficha.includes('usePodeConfigurar("operacional")'),
);
check(
  "o endpoint de responsável também exige Configurar",
  rpc.includes('requireModule("operacional", "configure")'),
);

console.log("\n  C — um responsável por caso\n");

check("o endpoint aceita no máximo um", rpc.includes("z.array(z.string().uuid()).max(1)"));
check(
  'a tela permite tirar o responsável ("sem vínculo")',
  dialog.includes("Sem responsável (distribui por pontos)"),
);
// Atribuir a alguém suspenso deixaria o caso sem dono de fato, e o motor não
// teria para quem direcionar.
check(
  "só usuários ATIVOS aparecem na lista",
  dialog.includes('status?.toUpperCase() === "ACTIVE"'),
);
check(
  "a tela explica o efeito no motor",
  dialog.includes("manda as tarefas deste caso para ele") &&
    dialog.includes("distribui por pontuação"),
);

if (falhou) {
  console.error(`\nS4-01: ${falhou} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nS4-01: todas as verificações passaram.");
