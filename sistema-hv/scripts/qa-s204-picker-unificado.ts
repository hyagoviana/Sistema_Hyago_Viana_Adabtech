// QA da unificação do diálogo de escolha de modelo (pendência 4 da S2-04).
//
// Os dois pontos de entrada — o botão do topo da ficha (`GenerateCaseDocumentFlow`)
// e o "Gerar documento" da aba Documentos (`CaseDocumentsTab`) — tinham cópias
// quase idênticas do mesmo diálogo, já divergidas entre si. Agora usam o mesmo
// `DocumentPickerDialog`.
//
// O risco de uma fusão assim é PERDER comportamento no caminho: um empty-state
// que sumiu, um aviso que ficou só de um lado, uma prop que deixou de ser
// repassada. Este QA lê os arquivos e prova que cada capacidade das duas cópias
// originais sobreviveu — é análise estática, não substitui clicar na tela, mas
// pega justamente o tipo de perda silenciosa que passa despercebido em revisão.
//
// Rodar: npx tsx scripts/qa-s204-picker-unificado.ts
import { readFileSync } from "node:fs";

const BASE = "src/components/cases";
const picker = readFileSync(`${BASE}/DocumentPickerDialog.tsx`, "utf8");
const flow = readFileSync(`${BASE}/GenerateCaseDocumentFlow.tsx`, "utf8");
const tab = readFileSync(`${BASE}/CaseDocumentsTab.tsx`, "utf8");

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

console.log("\n  A — não sobrou cópia do diálogo\n");

check("o diálogo existe num arquivo só", picker.includes("export function DocumentPickerDialog("));
for (const [nome, src] of [
  ["GenerateCaseDocumentFlow", flow],
  ["CaseDocumentsTab", tab],
] as const) {
  check(
    `${nome} não declara mais o próprio diálogo`,
    !/^function (PickDialog|GenerateDialog)\(/m.test(src),
  );
  check(`${nome} usa o DocumentPickerDialog`, src.includes("<DocumentPickerDialog"));
}

console.log("\n  B — as capacidades das DUAS cópias sobreviveram\n");

// Vinha só do GenerateCaseDocumentFlow.
check(
  "aviso de placeholder órfão (era exclusivo do popup da ficha)",
  picker.includes("orphanKeys"),
);
check(
  "abertura direta num modo/pasta (initialMode / initialFolderId)",
  picker.includes("initialMode") && picker.includes("initialFolderId"),
);

// Vinha só do CaseDocumentsTab.
check(
  "empty-state que cria a pasta do tipo e anexa o 1º Word",
  picker.includes("criarPastaEAnexar") &&
    picker.includes("useCreateTypeFolder") &&
    picker.includes("useUploadTypeTemplate"),
);
check(
  "o empty-state é opcional, via prop",
  picker.includes("permiteCriarPasta") && picker.includes("permiteCriarPasta = false"),
);
check(
  "a aba Documentos liga o empty-state (é onde se configura o tema)",
  /<DocumentPickerDialog[\s\S]{0,80}permiteCriarPasta/.test(tab),
);
check(
  "o popup do topo NÃO liga o empty-state (é atalho, não configuração)",
  !/<DocumentPickerDialog[\s\S]{0,400}permiteCriarPasta/.test(flow),
);

console.log("\n  C — as 3 telas da S2-04 continuam de pé\n");

check("tela 1 — procuração ou documento do caso", picker.includes('setMode("procuracao")'));
check("tela 2 — tipo de caso", picker.includes("Escolha o tipo de caso"));
check("tela 3 — categoria do documento", picker.includes("Categoria do documento"));
check(
  "a categoria só entra para tipo com a estrutura nova",
  picker.includes("tipoTemEstrutura && !categoria"),
);
check(
  "categoria sem pasta aparece desabilitada, não sumida",
  picker.includes("pasta não criada") && picker.includes("disabled={!pasta}"),
);
check(
  "o voltar anda UM passo por vez",
  picker.includes("tipoTemEstrutura && categoria") && picker.includes("← Trocar categoria"),
);

console.log("\n  D — a fonte das pastas de procuração é a unificada\n");

check("o picker usa useProcuracaoFolderIds", picker.includes("useProcuracaoFolderIds"));
check(
  "ninguém mais deriva as pastas de procuração na mão",
  !picker.includes('useTypeFolders(serviceTypeId, "procuracao"') &&
    !flow.includes('"procuracao",') &&
    !tab.includes('useTypeFolders(serviceTypeId, "procuracao"'),
);

console.log("\n  E — o contrato com quem chama não mudou\n");

// onGenerate é o ponto onde o diálogo devolve o resultado. Se a assinatura
// tivesse mudado na fusão, os dois lados quebrariam de formas diferentes.
for (const arg of ["templateId", "title", "values", "docKind", "folderId", "folderName"]) {
  check(`onGenerate ainda recebe "${arg}"`, picker.includes(arg));
}
check("os dois lados passam onGenerate", /onGenerate=\{/.test(flow) && /onGenerate=\{/.test(tab));

if (falhou) {
  console.error(`\nPICKER UNIFICADO: ${falhou} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nPICKER UNIFICADO: todas as verificações passaram.");
