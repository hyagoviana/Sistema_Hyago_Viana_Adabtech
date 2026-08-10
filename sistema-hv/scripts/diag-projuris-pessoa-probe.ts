// Sonda o /pessoa/consulta: envelope, total de registros e params de paginação.
// SO LEITURA.
import { config } from "dotenv";
config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  // 1) Envelope cru (top-level keys + qualquer campo de total).
  const raw = (await client.projurisGet<Record<string, unknown>>("pessoa/consulta")) ?? {};
  console.log("Top-level keys:", Object.keys(raw));
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" || typeof v === "string") console.log(`  ${k}: ${v}`);
    if (Array.isArray(v)) console.log(`  ${k}: [array len ${v.length}]`);
  }

  // 2) Tenta variações de paginação via query.
  const variacoes: Record<string, string | number>[] = [
    { quantidade: 1000 },
    { tamanhoPagina: 1000 },
    { "registros-por-pagina": 1000 },
    { qtdRegistros: 1000 },
    { limite: 1000 },
    { size: 1000 },
    { pagina: 2 },
  ];
  for (const q of variacoes) {
    try {
      const r = (await client.projurisGet<Record<string, unknown>>("pessoa/consulta", q)) ?? {};
      // acha o 1o array em profundidade
      let arr: unknown[] = [];
      for (const v of Object.values(r)) if (Array.isArray(v) && v.length > arr.length) arr = v;
      console.log(`  query ${JSON.stringify(q)} → ${arr.length} registros`);
    } catch (e) {
      console.log(`  query ${JSON.stringify(q)} → erro: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
