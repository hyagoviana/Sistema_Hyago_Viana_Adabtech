// Testa o motor Google Docs fim-a-fim: cria doc -> troca placeholders ->
// torna editável por link -> exporta PDF.
// Uso: npx tsx scripts/google-docs-test.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  createDocWithText,
  replacePlaceholders,
  setLinkEditable,
  exportPdf,
  docUrl,
} from "../src/lib/google/docs";

async function main() {
  console.log("\n🧪 Teste do motor Google Docs (conta-sistema)\n");

  const modelo = [
    "DECLARAÇÃO (modelo de teste — Sistema HV)",
    "",
    "Cliente: <nome>",
    "CPF: <cpf>",
    "Percentual de honorários: <percentual>",
    "Período: <periodo>",
    "",
    "Campo deixado em branco para terceiro: ____________________",
  ].join("\n");

  console.log("  1) Criando Google Doc com placeholders <campo>...");
  const id = await createDocWithText("TESTE Adabtech — Documento gerado", modelo);
  console.log(`     doc id: ${id}`);

  console.log("  2) Substituindo placeholders (auto-preenchimento)...");
  await replacePlaceholders(id, {
    nome: "João da Silva",
    cpf: "123.456.789-00",
    percentual: "15%",
    periodo: "abr/2020 a dez/2021",
  });

  console.log("  3) Tornando editável por link (editor embutido, sem login)...");
  await setLinkEditable(id);

  console.log("  4) Exportando PDF...");
  const pdf = await exportPdf(id);
  console.log(`     PDF gerado: ${pdf.byteLength} bytes`);

  console.log("\n✅ Motor Google Docs validado fim-a-fim.\n");
  console.log("  👉 Abra e edite (sem precisar logar):");
  console.log(`     ${docUrl(id)}\n`);
}

main().catch((err) => {
  console.error("\n❌ Falhou:", err?.message ?? err, err?.status ? `(status ${err.status})` : "");
  process.exitCode = 1;
});
