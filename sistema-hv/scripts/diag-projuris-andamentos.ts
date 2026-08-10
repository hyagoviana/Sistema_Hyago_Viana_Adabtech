// Sonda a forma dos ANDAMENTOS (v2/processo-andamento/consulta) p/ achar
// data/tipo/descrição da ÚLTIMA decisão. SO LEITURA.
import { config } from "dotenv";
config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") {
        const inner = firstArrayDeep(val);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  // processos com capturaHabilitada=true da sondagem anterior
  const cods = [27279533, 27037228, 26015893];
  for (const cod of cods) {
    const raw = await client.projurisPostConsulta<unknown>("v2/processo-andamento/consulta", {
      codigoProcesso: cod,
      quantidadeRegistros: 5,
      registroInicial: 0,
    });
    const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;
    console.log(`\n===== processo ${cod} — ${arr.length} andamentos =====`);
    if (arr.length) {
      console.log(`  chaves do 1o: ${Object.keys(arr[0]).sort().join(", ")}`);
      for (const a of arr.slice(0, 3)) {
        console.log(`    ${JSON.stringify(a).slice(0, 260)}`);
      }
    }
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
