// Smoke test do ZapSign — valida que o token autentica no sandbox.
// NÃO imprime o token. Uso: node sistema-hv/scripts/zapsign-smoke.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const env = parseEnv(envPath);
const token = env.ZAPSIGN_API_TOKEN;
const SANDBOX = "https://sandbox.api.zapsign.com.br/api/v1";
const PROD = "https://api.zapsign.com.br/api/v1";
const configured = (env.ZAPSIGN_API_BASE_URL || SANDBOX).replace(/\/+$/, "");

if (!token) {
  console.error("❌ ZAPSIGN_API_TOKEN não encontrado no .env.local");
  process.exit(1);
}

async function tryBase(label, base) {
  const url = `${base}/docs/`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    const count = Array.isArray(body?.results) ? body.results.length : (body?.count ?? "?");
    console.log(`  ${res.ok ? "✅" : "⚠️ "} ${label.padEnd(8)} ${res.status} ${res.statusText}` +
      (res.ok ? ` — docs visíveis: ${count}` : ` — ${JSON.stringify(body).slice(0, 160)}`));
    return res.ok;
  } catch (err) {
    console.log(`  ❌ ${label.padEnd(8)} erro de rede: ${String(err).slice(0, 120)}`);
    return false;
  }
}

console.log(`\n🔌 ZapSign smoke test (token: ****${token.slice(-4)})`);
console.log(`   base configurada: ${configured}\n`);
const okConfigured = await tryBase("config", configured);
if (!okConfigured) {
  console.log("\n   Testando os dois ambientes para descobrir a qual o token pertence:");
  await tryBase("sandbox", SANDBOX);
  await tryBase("prod", PROD);
}
console.log("");
