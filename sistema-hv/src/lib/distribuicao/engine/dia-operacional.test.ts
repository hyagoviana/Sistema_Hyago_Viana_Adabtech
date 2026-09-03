// S1-02 (reunião 02/09) — testes leves (npx tsx, sem runner/banco) da régua de
// DIA OPERACIONAL usada pelo cron da distribuição.
//
// Thiago: "Ele tá distribuindo sábado, tá? Sábado e domingo ele tá distribuindo
// tarefa, está considerando como dia útil."
//
// `isOperationalDate` (sync-core) = isWeekday(data) E sem bloqueio 'general' no
// calendário. A parte que depende do banco não entra aqui; o que se testa é a
// régua pura de fim de semana e a composição com o conjunto de bloqueios — a
// mesma que a engine já usa para a data-alvo.
// Rodar: npx tsx src/lib/distribuicao/engine/dia-operacional.test.ts

import { isWeekday, isOperationalDay, buildGeneralBlockSet } from "./date-utils";
import type { CalendarDay } from "./types";

let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// Semana de referência: 2026-09-07 (segunda) … 2026-09-13 (domingo).
assert("segunda é dia útil", isWeekday("2026-09-07"));
assert("sexta é dia útil", isWeekday("2026-09-11"));
assert("sábado NÃO é dia útil", !isWeekday("2026-09-12"));
assert("domingo NÃO é dia útil", !isWeekday("2026-09-13"));

// Bloqueio geral (feriado/recesso cadastrado no calendário) derruba o dia útil.
const calendario: CalendarDay[] = [
  {
    date: "2026-09-07",
    globally_operational: false, // feriado da Independência
    initial_team_points: 0,
    blocked_executor_ids: [],
  },
];
const blocks = buildGeneralBlockSet(calendario);

assert("segunda com bloqueio geral NÃO é operacional", !isOperationalDay("2026-09-07", blocks));
assert("terça sem bloqueio é operacional", isOperationalDay("2026-09-08", blocks));
assert("sábado segue não operacional mesmo sem bloqueio", !isOperationalDay("2026-09-12", blocks));

// A regra de fim de semana é de CÓDIGO: o calendário não precisa ter sábados
// cadastrados para o motor pular o fim de semana (o owner recusou cadastrar
// todo sábado do ano: "mas é muito sábado").
assert("nenhum sábado precisa estar no calendário", blocks.size === 1);

if (failed) {
  console.error(`\nDIA OPERACIONAL: ${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("DIA OPERACIONAL: todos os testes passaram.\n");
