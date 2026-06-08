// Empurra as variáveis do .env.local para o Vercel (production + preview),
// sem imprimir os valores. Uso: node scripts/vercel-push-env.mjs
import { config } from "dotenv";

config({ path: ".env.local" });

import { spawnSync } from "node:child_process";

const SCOPE = "hyagovianas-projects";
const KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_DRIVE_ROOT_FOLDER_ID",
  "GOOGLE_DRIVE_SHARED_DRIVE_ID",
  "GOOGLE_DRIVE_CLIENTS_FOLDER_ID",
  "GOOGLE_DRIVE_DEFAULT_PERMISSION",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
  "ZAPSIGN_API_TOKEN",
  "ZAPSIGN_API_BASE_URL",
  "APP_ENV",
  "APP_URL",
];
const ENVS = ["production", "preview"];

let ok = 0;
let fail = 0;
for (const key of KEYS) {
  const val = process.env[key];
  if (!val) {
    console.log(`· skip (vazio): ${key}`);
    continue;
  }
  for (const env of ENVS) {
    const r = spawnSync(
      "npx",
      ["vercel", "env", "add", key, env, "--scope", SCOPE],
      { input: val, encoding: "utf8", shell: true },
    );
    if (r.status === 0) {
      console.log(`✓ ${key} [${env}]`);
      ok++;
    } else {
      const tail = (r.stderr || r.stdout || "").split("\n").filter(Boolean).slice(-1)[0] ?? "";
      console.log(`✗ ${key} [${env}] — ${tail}`);
      fail++;
    }
  }
}
console.log(`\nResumo: ${ok} ok, ${fail} falhas`);
