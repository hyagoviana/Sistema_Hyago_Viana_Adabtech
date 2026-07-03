// Sobe os 2 modelos de Termo de Acerto (.docx) para a pasta de modelos do Drive,
// convertendo para Google Doc, e roda o sync p/ registrar em system_document_templates.
// Idempotente: se já existir um Google Doc com o mesmo nome na pasta, não duplica.
//
// Uso (a partir de sistema-hv/):  npx tsx scripts/upload-termo-templates.ts
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { getDriveClient, listFilesInFolder } from "../src/lib/google/drive";
import { syncTemplatesFromDrives } from "../src/lib/template-sync-service";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GDOC_MIME = "application/vnd.google-apps.document";

const MODELS = [
  { name: "TERMO ACERTO PARCIAL", file: "../docs/modelos-termo/TERMO ACERTO PARCIAL.docx" },
  {
    name: "TERMO ACERTO COMPLEMENTAR",
    file: "../docs/modelos-termo/TERMO ACERTO COMPLEMENTAR.docx",
  },
];

async function main() {
  const raw = process.env.GOOGLE_DRIVE_TEMPLATES_FOLDER_ID;
  if (!raw) {
    console.error("GOOGLE_DRIVE_TEMPLATES_FOLDER_ID não configurado no .env.local");
    process.exit(1);
  }
  const folderId = raw.split(",")[0].trim(); // primeira pasta = raiz de modelos
  const drive = getDriveClient();

  // arquivos já existentes na pasta (p/ não duplicar)
  const existing = await listFilesInFolder(folderId, 200);
  const byName = new Map(existing.map((f) => [(f.name ?? "").trim().toUpperCase(), f]));

  for (const m of MODELS) {
    const already = byName.get(m.name.toUpperCase());
    if (already) {
      console.log(`JÁ EXISTE: "${m.name}" (id ${already.id}) — pulando upload.`);
      continue;
    }
    const path = resolve(process.cwd(), m.file);
    const res = await drive.files.create({
      requestBody: { name: m.name, mimeType: GDOC_MIME, parents: [folderId] },
      media: { mimeType: DOCX_MIME, body: createReadStream(path) },
      fields: "id,name",
      supportsAllDrives: true,
    });
    console.log(`CRIADO: "${res.data.name}" (Google Doc id ${res.data.id})`);
  }

  console.log("\n--- Sincronizando modelos (registra em system_document_templates) ---");
  const sync = await syncTemplatesFromDrives([folderId]);
  console.log(JSON.stringify(sync, null, 2));
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
