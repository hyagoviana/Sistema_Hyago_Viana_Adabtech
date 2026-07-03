// Aplica (PUT) um workflow reescrito no n8n via Public API. Envia só {name,nodes,connections,settings}.
// Uso: npx tsx scripts/n8n-push.ts <arquivo.json> [workflowId]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnvFile(): Record<string, string> {
  const path = resolve(process.cwd(), "..", "env");
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_\-]+)\s*=\s*(.*)$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = readEnvFile();
const key = env["n8n-api-key"] || env["N8N_API_KEY"];
const base = (env["URL_N8N"] || "https://n8n.sistemahyagoviana.com.br").replace(/\/$/, "");
const file = process.argv[2] || resolve(process.cwd(), "..", "fluxo-n8n-OPCAO-A.json");
const id = process.argv[3] || "SizyKzXRq14mzzWZ";
if (!key) {
  console.error("Faltou n8n-api-key no arquivo env");
  process.exit(1);
}

const wf = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
const body = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings ?? { executionOrder: "v1" },
};

const put = await fetch(`${base}/api/v1/workflows/${id}`, {
  method: "PUT",
  headers: { "X-N8N-API-KEY": key, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log("PUT HTTP", put.status);
const txt = await put.text();
if (!put.ok) {
  console.error(txt.slice(0, 800));
  process.exit(1);
}

// verifica
const get = await fetch(`${base}/api/v1/workflows/${id}`, {
  headers: { "X-N8N-API-KEY": key, accept: "application/json" },
});
const now = (await get.json()) as { name?: string; nodes?: unknown[]; active?: boolean };
console.log(`OK -> "${now.name}" | nodes: ${now.nodes?.length} | active: ${now.active}`);
