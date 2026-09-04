// QA S1-02 (03/09) — prova contra o BANCO REAL de que o bloqueio geral é
// respeitado, inclusive na data que tem DUAS linhas 'general' (2026-12-31), que
// era o caso em que a versão com `.maybeSingle()` falhava para "operacional".
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { isOperationalDate } from "../src/lib/distribuicao/sync-core";

const casos: Array<[string, boolean, string]> = [
  ["2026-12-31", false, "quinta-feira COM bloqueio geral (2 linhas duplicadas)"],
  ["2026-09-04", true, "sexta-feira comum"],
  ["2026-09-05", false, "sábado"],
  ["2026-09-06", false, "domingo"],
  ["2026-09-07", false, "segunda-feira COM bloqueio geral (7 de setembro)"],
  ["2026-09-08", true, "terça-feira comum"],
  // A3 (04/09) — feriados nacionais carregados automaticamente.
  ["2026-12-25", false, "Natal (carregado pelo script de feriados)"],
  ["2026-05-01", false, "Dia do Trabalho (idem)"],
  ["2026-06-04", false, "Corpus Christi — móvel, calculado pela Páscoa"],
  ["2026-02-17", false, "Carnaval (terça) — móvel"],
];

let falhou = 0;
for (const [data, esperado, desc] of casos) {
  const obtido = await isOperationalDate(data);
  const ok = obtido === esperado;
  if (!ok) falhou++;
  console.log(`  ${ok ? "✓" : "✗"} ${data} (${desc}) → operacional=${obtido}, esperado=${esperado}`);
}

if (falhou) {
  console.error(`\nDIA OPERACIONAL (banco): ${falhou} caso(s) falharam.`);
  process.exit(1);
}
console.log("\nDIA OPERACIONAL (banco): todos os casos passaram.");
