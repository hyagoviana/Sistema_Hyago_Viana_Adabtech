// Diagnóstico: lista os modelos de PROCURAÇÃO e quantas variáveis (fields) cada um
// tem. Aponta os que estão SEM variável (0 fields) e separa os termos de acerto.
// Uso: npx tsx scripts/check-procuracao-fields.ts
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";

function isTermo(name: string): boolean {
  const norm = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  return norm.includes("TERMO") && norm.includes("ACERTO");
}

const sb = getSupabaseAdmin();
const { data, error } = await sb
  .from("system_document_templates_active")
  .select("id, name, fields, google_doc_id")
  .eq("active", true)
  .eq("case_type", "PROCURACAO")
  .order("name", { ascending: true });

if (error) {
  console.error("Erro:", error.message);
  process.exit(1);
}

const rows = data ?? [];
const termos = rows.filter((r) => isTermo(r.name));
const procs = rows.filter((r) => !isTermo(r.name));
const fieldsLen = (f: unknown) => (Array.isArray(f) ? f.length : 0);
const semVar = procs.filter((r) => fieldsLen(r.fields) === 0);
const comVar = procs.filter((r) => fieldsLen(r.fields) > 0);

console.log(`\n=== PROCURAÇÕES (case_type=PROCURACAO) ===`);
console.log(
  `Total procurações: ${procs.length} | com variáveis: ${comVar.length} | SEM variáveis: ${semVar.length}`,
);
console.log(`Termos de acerto (excluídos do picker): ${termos.length}`);

console.log(`\n--- ⚠️  SEM VARIÁVEL (precisam de placeholders) ---`);
if (semVar.length === 0) console.log("  (nenhuma — todas têm variáveis)");
for (const r of semVar) console.log(`  ⚠️  ${r.name}`);

console.log(`\n--- ✅  COM VARIÁVEL ---`);
for (const r of comVar) console.log(`  ✅  ${r.name} — ${fieldsLen(r.fields)} campos`);

console.log(`\n--- 🧾  TERMOS (não aparecem no picker) ---`);
for (const r of termos) console.log(`  🧾  ${r.name}`);

process.exit(0);
