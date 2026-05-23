// Testes leves do validateUpload — sem runner, falha = exit 1.

import { ALLOWED_MIMES, MAX_UPLOAD_BYTES, validateUpload } from "./file";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

const PDF_HEAD = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const DOCX_HEAD = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]); // PK\x03\x04
const TXT_HEAD = Buffer.from("Olá mundo", "utf-8");
const EXE_HEAD = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ (PE header)

console.log("Aceita arquivos válidos");
assert(
  "PDF válido",
  validateUpload({ name: "doc.pdf", mimeType: "application/pdf", size: 1024, head: PDF_HEAD }).ok,
);
assert(
  "PNG válido",
  validateUpload({ name: "img.png", mimeType: "image/png", size: 1024, head: PNG_HEAD }).ok,
);
assert(
  "JPEG válido",
  validateUpload({ name: "img.jpg", mimeType: "image/jpeg", size: 1024, head: JPEG_HEAD }).ok,
);
assert(
  "DOCX válido",
  validateUpload({
    name: "doc.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 1024,
    head: DOCX_HEAD,
  }).ok,
);
assert(
  "TXT válido (sem magic bytes check)",
  validateUpload({ name: "n.txt", mimeType: "text/plain", size: 100, head: TXT_HEAD }).ok,
);

console.log("\nRejeita");
const tooBig = validateUpload({
  name: "huge.pdf",
  mimeType: "application/pdf",
  size: MAX_UPLOAD_BYTES + 1,
  head: PDF_HEAD,
});
assert("arquivo > 20MB", !tooBig.ok && tooBig.status === 413);

const badMime = validateUpload({
  name: "code.exe",
  mimeType: "application/octet-stream",
  size: 100,
  head: EXE_HEAD,
});
assert("mime não permitido", !badMime.ok && badMime.status === 415);

const spoofed = validateUpload({
  name: "fake.pdf",
  mimeType: "application/pdf",
  size: 100,
  head: EXE_HEAD,
});
assert("EXE renomeado pra .pdf rejeitado (magic bytes)", !spoofed.ok && spoofed.status === 415);

const empty = validateUpload({
  name: "e.pdf",
  mimeType: "application/pdf",
  size: 0,
  head: PDF_HEAD,
});
assert("arquivo vazio rejeitado", !empty.ok && empty.status === 400);

const noName = validateUpload({ name: "", mimeType: "application/pdf", size: 10, head: PDF_HEAD });
assert("nome vazio rejeitado", !noName.ok && noName.status === 400);

console.log(`\nALLOWED_MIMES tem ${ALLOWED_MIMES.size} entradas`);
assert("8 mimes permitidos", ALLOWED_MIMES.size === 8);

console.log();
if (failed > 0) {
  console.error(`❌ ${failed} teste(s) falhou(aram).`);
  process.exit(1);
}
console.log("🎉 Todos os testes passaram.");
