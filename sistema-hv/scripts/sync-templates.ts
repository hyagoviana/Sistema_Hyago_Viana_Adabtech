// Re-sincroniza os modelos do Drive → system_document_templates.
// Uso: npx tsx scripts/sync-templates.ts
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { syncTemplatesFromDrives } from "../src/lib/template-sync-service";

const raw = process.env.GOOGLE_DRIVE_TEMPLATES_FOLDER_ID;
if (!raw) {
  console.error("GOOGLE_DRIVE_TEMPLATES_FOLDER_ID não configurado");
  process.exit(1);
}
const folders = raw.split(",").map((s) => s.trim()).filter(Boolean);
const res = await syncTemplatesFromDrives(folders);
console.log(`created=${res.created} updated=${res.updated} skipped=${res.skipped} errors=${res.errors.length}`);
if (res.errors.length) console.log(res.errors.slice(0, 5));
process.exit(0);
