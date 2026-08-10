// Testes leves (npx tsx) da derivação COMPLEXO/COLETIVO por marcador (M13).
// Garante o casamento tolerante a grafia + o fallback determinístico — para que,
// quando a equipe do Thiago preencher os marcadores reais, o motor reaja certo.
// Rodar: npx tsx src/lib/distribuicao/marcadores.test.ts

import { deriveFromMarcadores } from "./marcadores";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

console.log("MARCADORES — COMPLEXO/COLETIVO");

// Fallback determinístico: nada / desconhecido → individual, não-complexo.
const f0 = deriveFromMarcadores([]);
assert("vazio → collective=false, complexity=0", !f0.collective && f0.complexity_level === 0);
const f1 = deriveFromMarcadores(["ALGO QUE NAO EXISTE"]);
assert(
  "marcador desconhecido → fallback 0/false, matched vazio",
  !f1.collective && f1.complexity_level === 0 && f1.matched.length === 0,
);

// Coletivo.
assert("COLETIVO → collective=true", deriveFromMarcadores(["COLETIVO"]).collective === true);
assert(
  "acento/caixa: 'Ação Coletiva' → collective=true",
  deriveFromMarcadores(["Ação Coletiva"]).collective === true,
);

// Complexo (níveis).
assert("COMPLEXO → complexity_level=1", deriveFromMarcadores(["COMPLEXO"]).complexity_level === 1);
assert(
  "MUITO COMPLEXO → complexity_level=2",
  deriveFromMarcadores(["MUITO COMPLEXO"]).complexity_level === 2,
);
assert("caixa baixa 'complexo' → 1", deriveFromMarcadores(["complexo"]).complexity_level === 1);

// Pega o MAIOR nível de complexidade entre vários marcadores.
const mx = deriveFromMarcadores(["COMPLEXO", "MUITO COMPLEXO"]);
assert("máximo: [COMPLEXO, MUITO COMPLEXO] → 2", mx.complexity_level === 2);

// Combinação coletivo + complexo.
const comb = deriveFromMarcadores(["COLETIVO", "COMPLEXO", "IRRELEVANTE"]);
assert("combo: coletivo=true + complexo=1", comb.collective && comb.complexity_level === 1);
assert("combo: matched só os 2 conhecidos", comb.matched.length === 2);

if (failed) {
  console.error(`\nMARCADORES: ${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("MARCADORES: todos os testes passaram.\n");
