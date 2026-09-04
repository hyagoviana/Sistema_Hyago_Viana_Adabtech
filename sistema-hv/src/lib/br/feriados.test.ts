// Testes leves (npx tsx, sem runner/banco) dos feriados nacionais.
// Datas conferidas contra o calendário oficial.
// Rodar: npx tsx src/lib/br/feriados.test.ts

import { domingoDePascoa, feriadosNacionais, feriadosNacionaisEntre } from "./feriados";

let failed = 0;
function assert(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    failed++;
  }
}

function dataDe(ano: number, nome: string): string | undefined {
  return feriadosNacionais(ano).find((f) => f.nome === nome)?.date;
}

// Páscoa — âncora dos móveis. Valores conhecidos.
const pascoa = (ano: number) => domingoDePascoa(ano).toISOString().slice(0, 10);
assert("Páscoa 2026 = 05/04", pascoa(2026) === "2026-04-05", pascoa(2026));
assert("Páscoa 2027 = 28/03", pascoa(2027) === "2027-03-28", pascoa(2027));
assert("Páscoa 2025 = 20/04", pascoa(2025) === "2025-04-20", pascoa(2025));

// Móveis de 2026 (derivados da Páscoa de 05/04).
assert("Sexta-feira Santa 2026 = 03/04", dataDe(2026, "Sexta-feira Santa") === "2026-04-03");
assert("Carnaval (terça) 2026 = 17/02", dataDe(2026, "Carnaval (terça)") === "2026-02-17");
assert("Carnaval (segunda) 2026 = 16/02", dataDe(2026, "Carnaval (segunda)") === "2026-02-16");
assert("Corpus Christi 2026 = 04/06", dataDe(2026, "Corpus Christi") === "2026-06-04");

// Fixos.
assert("Independência = 07/09", dataDe(2026, "Independência do Brasil") === "2026-09-07");
assert("Consciência Negra = 20/11", dataDe(2026, "Consciência Negra") === "2026-11-20");
assert("Natal = 25/12", dataDe(2026, "Natal") === "2026-12-25");

// Sanidade geral.
const lista2026 = feriadosNacionais(2026);
assert("13 feriados no ano", lista2026.length === 13, String(lista2026.length));
assert(
  "vem ordenado por data",
  lista2026.every((f, i) => i === 0 || lista2026[i - 1].date <= f.date),
);
assert("sem datas repetidas", new Set(lista2026.map((f) => f.date)).size === lista2026.length);
assert(
  "toda data no formato YYYY-MM-DD do ano pedido",
  lista2026.every((f) => /^2026-\d{2}-\d{2}$/.test(f.date)),
);

// Intervalo.
const tresAnos = feriadosNacionaisEntre(2026, 2028);
assert("3 anos = 39 feriados", tresAnos.length === 39, String(tresAnos.length));

if (failed) {
  console.error(`\nFERIADOS: ${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("FERIADOS: todos os testes passaram.\n");
