// Puxa (GET) um workflow do n8n via Public API e salva em arquivo, SEM expor a key.
// Lê a key/URL do arquivo `env` na raiz do projeto (n8n-api-key / URL_N8N).
// Uso: npx tsx scripts/n8n-pull.ts <workflowId> [arquivoSaida]
import { readFileSync, writeFileSync } from "node:fs";
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
const id = process.argv[2] || "SizyKzXRq14mzzWZ";
const outFile = process.argv[3] || resolve(process.cwd(), "..", "fluxo-n8n-LIVE.json");

if (!key) {
  console.error("Faltou n8n-api-key no arquivo env");
  process.exit(1);
}

const res = await fetch(`${base}/api/v1/workflows/${id}`, {
  headers: { "X-N8N-API-KEY": key, accept: "application/json" },
});
console.log("HTTP", res.status);
if (!res.ok) {
  console.error((await res.text()).slice(0, 500));
  process.exit(1);
}
const wf = (await res.json()) as { name?: string; nodes?: unknown[]; active?: boolean };
writeFileSync(outFile, JSON.stringify(wf, null, 2), "utf8");
console.log(`Workflow: "${wf.name}" | nodes: ${wf.nodes?.length ?? "?"} | active: ${wf.active}`);
console.log(`Salvo em: ${outFile}`);
