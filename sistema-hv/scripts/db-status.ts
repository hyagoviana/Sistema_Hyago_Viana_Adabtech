// Lista o estado das tabelas do sistema HV no Supabase.
// Uso: npx tsx scripts/db-status.ts

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";

const SYSTEM_ENTITIES = [
  { name: "system_organizations", kind: "table" },
  { name: "system_clients", kind: "table" },
  { name: "system_client_documents", kind: "table" },
  { name: "system_audit_log", kind: "table" },
  { name: "system_clients_active", kind: "view" },
  { name: "system_client_documents_active", kind: "view" },
  { name: "system_cases", kind: "table" },
  { name: "system_case_events", kind: "table" },
  { name: "system_cases_active", kind: "view" },
] as const;

async function main() {
  console.log("📊 Status do banco — Sistema HV\n");
  const sb = getSupabaseAdmin();

  for (const entity of SYSTEM_ENTITIES) {
    const { count, error } = await sb
      .from(entity.name)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`   ❌ ${entity.name.padEnd(35)} (${entity.kind})  → ERRO: ${error.message}`);
    } else {
      console.log(
        `   ✅ ${entity.name.padEnd(35)} (${entity.kind})  → ${count ?? 0} linha(s)`,
      );
    }
  }
  console.log();
}

main().catch((err) => {
  console.error("❌ Falha:", err);
  process.exit(1);
});
