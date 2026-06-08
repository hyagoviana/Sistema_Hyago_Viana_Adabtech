// Cria um Google Doc de teste (com placeholders) e cadastra como modelo,
// pra dar o que gerar no QA da aba Documentos.
// Uso: npx tsx scripts/seed-test-template.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { createDocWithText, docUrl } from "../src/lib/google/docs";
import { createDocumentTemplate } from "../src/lib/document-templates-service";

const body = [
  "DECLARAÇÃO (modelo de teste — Sistema HV)",
  "",
  "Cliente: <nome>",
  "CPF: <cpf>",
  "Percentual de honorários: <percentual>",
  "Período: <periodo>",
  "",
  "Campo a ser preenchido por terceiro: ____________________",
].join("\n");

async function main() {
  console.log("\n🌱 Criando Google Doc do modelo de teste...");
  const docId = await createDocWithText("MODELO TESTE — Declaração HV", body);
  console.log("   google doc:", docUrl(docId));

  const tpl = await createDocumentTemplate({
    name: "Declaração de Teste (HV)",
    google_doc_id: docId,
    case_type: null, // aplica a qualquer caso
    goes_to_zapsign: true,
    fields: [
      { key: "nome", label: "Nome do cliente", source: "manual", required: true },
      { key: "cpf", label: "CPF", source: "manual", required: true },
      { key: "percentual", label: "Percentual (%)", source: "manual", required: true },
      { key: "periodo", label: "Período", source: "manual", required: false },
    ],
  });

  console.log("\n✅ Modelo cadastrado:");
  console.log("   id:", tpl.id);
  console.log("   nome:", tpl.name, "(vale para qualquer caso)\n");
}

main().catch((err) => {
  console.error("❌ Falhou:", err?.message ?? err);
  process.exitCode = 1;
});
