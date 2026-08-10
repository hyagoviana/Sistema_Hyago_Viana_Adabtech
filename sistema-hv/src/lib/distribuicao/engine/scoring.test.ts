// Testes leves (npx tsx, sem runner/banco) do SCORING do motor de distribuição.
// Falha = stderr + exit 1. Cobre: max() de complexidade/temporal, pontos base,
// teto MAX_TOTAL_MODIFIER=0.8 (ressalva do QA), semântica do FALLBACK (points=1,
// níveis 0 → sem modificador). Rodar: npx tsx src/lib/distribuicao/engine/scoring.test.ts

import {
  calculateBasePoints,
  calculateFinalComplexity,
  calculateFinalPoints,
  calculateFinalTemporal,
  scoreTask,
  type ScoringModifiers,
} from "./scoring";
import type { Process, Task } from "./types";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function mkTask(over: Partial<Task> = {}): Task {
  return {
    task_id: "t1",
    process_id: "p1",
    task_type_id: "TT",
    theme_id: "TH",
    task_type_points: 1,
    theme_multiplier: 1,
    task_type_complexity_level: 0,
    task_type_temporal_level: 0,
    task_override_complexity_level: 0,
    task_override_temporal_level: 0,
    theme_complexity_level: 0,
    theme_temporal_level: 0,
    fatal_date: "9999-12-31",
    internal_limit_date: "9999-12-31",
    input_order: 1,
    ...over,
  };
}
function mkProc(over: Partial<Process> = {}): Process {
  return {
    process_id: "p1",
    theme_id: "TH",
    collective: false,
    complexity_level: 0,
    temporal_level: 0,
    directed_executor_id: null,
    ...over,
  };
}

console.log("SCORING — motor de distribuição");

// max() de complexidade/temporal entre process/theme/task_type/override.
assert(
  "complexidade final = max dos 4 (theme=2 vence)",
  calculateFinalComplexity(mkTask({ theme_complexity_level: 2 }), mkProc()) === 2,
);
assert(
  "complexidade final pega o override (override=1)",
  calculateFinalComplexity(mkTask({ task_override_complexity_level: 1 }), mkProc()) === 1,
);
assert(
  "temporal final = max (urgente=2 do processo vence prioritario=1 do tipo)",
  calculateFinalTemporal(mkTask({ task_type_temporal_level: 1 }), mkProc({ temporal_level: 2 })) ===
    2,
);

// pontos base = points * multiplier.
assert(
  "base = points(3) * multiplier(2) = 6",
  calculateBasePoints(mkTask({ task_type_points: 3, theme_multiplier: 2 })) === 6,
);

// FALLBACK: points=1, tudo 0 → base 1, sem modificador → final 1.
const fb = scoreTask(mkTask({ task_type_points: 1, theme_multiplier: 1 }), mkProc());
assert("fallback (points=1, níveis 0) → base 1", fb.base_points === 1);
assert("fallback sem modificador → final 1", fb.final_points === 1);

// modificadores somam (collective 0.2 + complexity 0.2 + temporal 0 = 0.4).
const s = scoreTask(
  mkTask({ task_type_points: 10, theme_multiplier: 1, theme_complexity_level: 1 }),
  mkProc({ collective: true }),
);
assert("modificador total = 0.4 (coletivo+complexo1)", s.total_modifier === 0.4);
assert("final = base(10) * 1.4 = 14", s.final_points === 14);

// TETO MAX_TOTAL_MODIFIER = 0.8 (ressalva do QA): soma > 0.8 é capada.
const capMods: ScoringModifiers = { collective: 0.5, complexity: 0.5, temporal: 0.5 }; // 1.5
assert(
  "teto: base(10) * (1 + min(1.5, 0.8)) = 18 (não 25)",
  calculateFinalPoints(10, capMods) === 18,
);
// no limite exato (0.2+0.3+0.3 = 0.8) não capa nada.
const s2 = scoreTask(
  mkTask({ task_type_points: 10, theme_complexity_level: 2, theme_temporal_level: 2 }),
  mkProc({ collective: true }),
);
assert("no limite 0.8: total_modifier = 0.8", s2.total_modifier === 0.8);
assert("no limite 0.8: final = 10 * 1.8 = 18", s2.final_points === 18);

// determinismo (pure function).
const a = scoreTask(mkTask({ task_type_points: 7 }), mkProc());
const b = scoreTask(mkTask({ task_type_points: 7 }), mkProc());
assert("scoreTask é determinístico", JSON.stringify(a) === JSON.stringify(b));

if (failed) {
  console.error(`\nSCORING: ${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("SCORING: todos os testes passaram.\n");
