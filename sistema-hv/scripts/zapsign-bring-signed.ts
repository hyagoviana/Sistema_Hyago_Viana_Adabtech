// Prova o fluxo "documento assinado -> pasta no Drive" no SANDBOX.
//
// Fase 1 (sem argumento): cria um documento assinável (modo assinaturaTela)
//   e imprime o link de assinatura.
//     npx tsx scripts/zapsign-bring-signed.ts
//
// Fase 2 (com o token do doc): consulta o ZapSign; se já assinado, baixa o
//   PDF assinado ORIGINAL e sobe numa pasta de teste no Drive.
//     npx tsx scripts/zapsign-bring-signed.ts <doc_token>
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { createDocument, getDocument } from "../src/lib/zapsign/client";
import { createFolder, uploadFile } from "../src/lib/google/drive";

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

async function createSignable() {
  console.log("\n🖋️  Criando documento ASSINÁVEL no sandbox...\n");
  const doc = await createDocument({
    name: "TESTE Adabtech — trazer assinado p/ pasta",
    base64Pdf: minimalPdfBase64(),
    lang: "pt-br",
    signers: [
      { name: "Assinante de Teste", authMode: "assinaturaTela", sendAutomaticEmail: false },
    ],
  });
  console.log("  ✅ Criado.");
  console.log(`     token do doc: ${doc.token}`);
  console.log(`\n  👉 ASSINE AQUI (abra no navegador, desenhe e finalize):`);
  console.log(`     ${doc.signers[0]?.sign_url}`);
  console.log(`\n  Depois rode:`);
  console.log(`     npx tsx scripts/zapsign-bring-signed.ts ${doc.token}\n`);
}

async function bringSigned(token: string) {
  console.log(`\n📥 Consultando documento ${token}...\n`);
  const doc = await getDocument(token);
  console.log(`  status: ${doc.status}`);
  console.log(`  signed_file: ${doc.signed_file ?? "null"}`);

  if (!doc.signed_file) {
    console.log("\n  ⏳ Ainda não assinado (signed_file vazio). Assine pelo link e rode de novo.\n");
    return;
  }

  console.log("\n  ⬇️  Baixando o PDF assinado ORIGINAL do ZapSign...");
  const res = await fetch(doc.signed_file);
  if (!res.ok) throw new Error(`Falha ao baixar signed_file: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`     ${buffer.byteLength} bytes baixados.`);

  console.log("  📁 Criando pasta de teste no Drive e subindo o arquivo...");
  const folder = await createFolder(`ZAPSIGN-TESTE-${token.slice(0, 8)}`);
  const file = await uploadFile({
    parentId: folder.id,
    name: `assinado-${token.slice(0, 8)}.pdf`,
    mimeType: "application/pdf",
    body: buffer,
  });

  console.log("\n  ✅ Documento assinado levado para a pasta do Drive:");
  console.log(`     pasta:   ${folder.url}`);
  console.log(`     arquivo: ${file.url}`);
  console.log("\n🎉 Fluxo 'assinado -> pasta' provado fim-a-fim.\n");
}

const token = process.argv[2];
(token ? bringSigned(token) : createSignable()).catch((err) => {
  console.error("\n❌ Falhou:", err?.toJSON ? JSON.stringify(err.toJSON(), null, 2) : err);
  process.exitCode = 1;
});
