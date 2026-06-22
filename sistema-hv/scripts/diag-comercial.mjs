// Diagnóstico: verifica se as colunas da migration caso_comercial existem no
// banco (mesmo banco usado por produção). Uso: node scripts/diag-comercial.mjs
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}
console.log("Banco:", url);
const sb = createClient(url, key);

async function check(table, col) {
  const { error } = await sb.from(table).select(col).limit(1);
  console.log(`${table}.${col}: ${error ? "❌ FALTA — " + error.message : "✅ OK"}`);
}

await check("system_cases", "aguardando_assinatura_at");
await check("system_cases", "assinatura_liberada_at");
await check("system_case_documents", "doc_kind");
await check("system_clients", "rg");
await check("system_clients", "custom_fields");
