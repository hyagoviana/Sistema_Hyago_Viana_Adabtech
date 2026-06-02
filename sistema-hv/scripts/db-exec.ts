// Aplica um arquivo .sql no banco Supabase via Management API (sem CLI).
// Usa SUPABASE_ACCESS_TOKEN (PAT de gerência) + SUPABASE_PROJECT_REF.
//
// Uso:
//   npx tsx scripts/db-exec.ts supabase/migrations/<arquivo>.sql
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];

if (!ref || !token) {
  console.error("Faltam SUPABASE_PROJECT_REF ou SUPABASE_ACCESS_TOKEN no .env.local");
  process.exit(1);
}
if (!file) {
  console.error("Uso: npx tsx scripts/db-exec.ts <arquivo.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
console.log("HTTP", res.status);
console.log(text || "(sem corpo)");
process.exit(res.ok ? 0 : 1);
