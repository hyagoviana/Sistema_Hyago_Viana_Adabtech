// R5-03 (B4) — testes do resolveUploadMime (candidato #2: .type vazio/octet-stream).
// Standalone (sem runner), falha = exit 1. Não toca Supabase/Google (fn pura).

import { resolveUploadMime } from "./case-documents-service";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

const PDF_HEAD = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const DOCX_HEAD = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]); // PK\x03\x04
const DOC_HEAD = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE
const EMPTY_HEAD = Buffer.from([]);

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

console.log("Aceita tipo declarado permitido");
assert(
  "PDF declarado",
  resolveUploadMime("application/pdf", "a.pdf", PDF_HEAD) === "application/pdf",
);
assert("DOCX declarado", resolveUploadMime(DOCX_MIME, "a.docx", DOCX_HEAD) === DOCX_MIME);

console.log("Infere quando .type vazio (candidato #2)");
assert("vazio + %PDF → pdf", resolveUploadMime("", "a.pdf", PDF_HEAD) === "application/pdf");
assert("vazio + PK + .docx → docx", resolveUploadMime("", "a.docx", DOCX_HEAD) === DOCX_MIME);
assert("vazio + OLE → doc", resolveUploadMime("", "a.doc", DOC_HEAD) === "application/msword");

console.log("Infere quando octet-stream");
assert(
  "octet-stream + .docx → docx",
  resolveUploadMime("application/octet-stream", "contrato.docx", DOCX_HEAD) === DOCX_MIME,
);
assert(
  "octet-stream + .pdf sem magic → pdf por extensão",
  resolveUploadMime("application/octet-stream", "x.pdf", EMPTY_HEAD) === "application/pdf",
);

console.log("Rejeita o que não deve passar");
assert("imagem explícita rejeitada", resolveUploadMime("image/png", "x.png", PDF_HEAD) === null);
assert("vazio + extensão .png rejeitada", resolveUploadMime("", "x.png", EMPTY_HEAD) === null);
assert(
  "octet-stream sem extensão/magic conhecida rejeitada",
  resolveUploadMime("application/octet-stream", "arquivo", EMPTY_HEAD) === null,
);

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
}
console.log("\nTodos os testes passaram");
