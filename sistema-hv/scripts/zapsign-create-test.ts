// Testa o adapter real do ZapSign criando 1 documento no SANDBOX.
// Sem validade jurídica; sem envio automático de e-mail (não notifica ninguém).
// Uso: npx tsx scripts/zapsign-create-test.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { createDocument, getDocument } from "../src/lib/zapsign/client";

// Gera um PDF mínimo válido (1 página em branco) e devolve em base64.
function minimalPdfBase64(): string {
  const header = "%PDF-1.4\n";
  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n",
  ];
  let body = header;
  const offsets: number[] = [];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += o;
  }
  const xrefStart = Buffer.byteLength(body, "latin1");
  let xref = "xref\n0 4\n0000000000 65535 f \n";
  for (const off of offsets) xref += String(off).padStart(10, "0") + " 00000 n \n";
  const trailer = `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, "latin1").toString("base64");
}

async function main() {
  console.log("\n🧪 Criando documento de teste no ZapSign sandbox...\n");

  const doc = await createDocument({
    name: "TESTE Adabtech — Sistema HV (sandbox)",
    base64Pdf: minimalPdfBase64(),
    lang: "pt-br",
    externalId: "smoke-test-doc-1",
    signers: [
      {
        name: "Signatário de Teste",
        email: "teste@adabtech.com.br",
        authMode: "tokenEmail",
        sendAutomaticEmail: false, // não dispara e-mail real
      },
    ],
  });

  console.log("  ✅ Documento criado");
  console.log(`     token:  ${doc.token}`);
  console.log(`     status: ${doc.status}`);
  console.log(`     signatários: ${doc.signers.length}`);
  for (const s of doc.signers) {
    console.log(`       - ${s.name}: ${s.sign_url}`);
  }

  // Confirma leitura pelo token
  const fetched = await getDocument(doc.token);
  console.log(`\n  ✅ getDocument OK — status atual: ${fetched.status}, signed_file: ${fetched.signed_file ?? "null"}`);
  console.log("\n🎉 Adapter ZapSign validado fim-a-fim no sandbox.\n");
}

main().catch((err) => {
  console.error("\n❌ Falhou:", err?.toJSON ? JSON.stringify(err.toJSON(), null, 2) : err);
  process.exitCode = 1;
});
