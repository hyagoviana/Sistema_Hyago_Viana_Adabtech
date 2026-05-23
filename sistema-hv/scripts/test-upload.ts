// Valida o fluxo de upload/download/delete de documentos chamando o
// documents-service diretamente (sem precisar de browser/dev server).
//
// Pré-condição: cliente com drive_folder_id criado.
//   - Se não houver, criamos um cliente real (com pasta no Drive) e limpamos no fim.
//
// Uso:
//   npx tsx scripts/test-upload.ts

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { createHash } from "node:crypto";

import { createClient as createClientFn, softDeleteClient } from "../src/lib/clients-service";
import {
  deleteClientDocument,
  downloadClientDocument,
  listClientDocuments,
  nodeStreamToWeb,
  uploadClientDocument,
} from "../src/lib/documents-service";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

async function main() {
  console.log("📤 Test-Upload — Sistema HV\n");

  // ─── 1. Criar cliente real (com pasta Drive) ─────────────────────────────
  console.log("1) Criando cliente de teste...");
  const cpf = `${Date.now()}`.slice(-11).padStart(11, "0");
  const client = await createClientFn({
    full_name: `TEST-UPLOAD ${Date.now()}`,
    cpf_cnpj: cpf,
    tipo: null,
    email: null,
    phone: null,
    address: null,
  });
  assert("cliente criado", !!client.id);
  assert("pasta Drive criada (drive_sync_failed=false)", !client.drive_sync_failed);
  if (client.drive_sync_failed) {
    console.error("⚠️  Drive falhou na criação — abortando teste de upload");
    await softDeleteClient(client.id);
    process.exit(1);
  }

  const PDF_BYTES = Buffer.concat([
    Buffer.from("%PDF-1.4\n", "utf-8"),
    Buffer.alloc(2048, 0x20), // padding
    Buffer.from("\n%%EOF", "utf-8"),
  ]);
  const sha256Expected = createHash("sha256").update(PDF_BYTES).digest("hex");

  // ─── 2. Upload válido ────────────────────────────────────────────────────
  console.log("\n2) Upload PDF válido...");
  const doc = await uploadClientDocument({
    clientId: client.id,
    fileName: `test-upload-${Date.now()}.pdf`,
    mimeType: "application/pdf",
    description: "Teste automatizado",
    buffer: PDF_BYTES,
  });
  assert("doc criado com id", !!doc.id);
  assert("sha256 gravado", doc.sha256 === sha256Expected);
  assert("size_bytes gravado", doc.size_bytes === PDF_BYTES.length);

  // ─── 3. Listar ───────────────────────────────────────────────────────────
  console.log("\n3) Listar docs do cliente...");
  const list = await listClientDocuments(client.id);
  assert(
    "lista contém o doc",
    list.some((d) => d.id === doc.id),
  );

  // ─── 4. Download e hash ──────────────────────────────────────────────────
  console.log("\n4) Download e verificar hash...");
  const { stream } = await downloadClientDocument({ clientId: client.id, docId: doc.id });
  const downloaded = await streamToBuffer(nodeStreamToWeb(stream));
  const sha256Got = createHash("sha256").update(downloaded).digest("hex");
  assert("bytes idênticos (sha256 confere)", sha256Got === sha256Expected);
  assert("tamanho confere", downloaded.length === PDF_BYTES.length);

  // ─── 5. Mime inválido rejeitado ──────────────────────────────────────────
  console.log("\n5) Tentar upload com mime inválido (deve falhar)...");
  let rejected = false;
  try {
    await uploadClientDocument({
      clientId: client.id,
      fileName: "evil.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
    });
  } catch (err) {
    rejected = err instanceof Error;
  }
  assert("mime não-permitido rejeitado", rejected);

  // ─── 6. Magic bytes (EXE renomeado pra PDF) ──────────────────────────────
  console.log("\n6) Tentar upload com magic bytes errados (.exe rotulado .pdf)...");
  let spoofRejected = false;
  try {
    await uploadClientDocument({
      clientId: client.id,
      fileName: "fake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(500)]),
    });
  } catch (err) {
    spoofRejected = err instanceof Error && err.message.toLowerCase().includes("spoof");
  }
  assert("EXE com extensão .pdf rejeitado por magic bytes", spoofRejected);

  // ─── 7. Delete (soft + trash Drive) ──────────────────────────────────────
  console.log("\n7) Delete do doc...");
  const delResult = await deleteClientDocument({ clientId: client.id, docId: doc.id });
  assert("delete retornou ok", delResult.ok);
  assert("drive_trashed reportado", typeof delResult.drive_trashed === "boolean");

  const listAfter = await listClientDocuments(client.id);
  assert("doc sumiu da view active", !listAfter.some((d) => d.id === doc.id));

  // ─── 8. Cleanup ──────────────────────────────────────────────────────────
  console.log("\n8) Cleanup do cliente de teste...");
  await softDeleteClient(client.id);
  console.log("   ✓ cliente soft-deletado\n");

  if (failed > 0) {
    console.error(`❌ ${failed} assertion(s) falhou(aram).`);
    process.exit(1);
  }
  console.log("🎉 Todos os testes de upload passaram.");
}

main().catch((err) => {
  console.error("\n❌ Falha:", err);
  process.exit(1);
});
