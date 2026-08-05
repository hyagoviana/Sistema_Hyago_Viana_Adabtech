/**
 * Teste dirigido — EXECUTOR EXCLUSIVO (excecoes do SHV).
 *
 * Prova que o engine (selectFlow) roteia via fluxo ABSOLUTE, direto ao executor
 * correto, para cada uma das 3 excecoes semeadas em 2026-08-05:
 *
 *   1. Audiencia (TIPO, projuris_tipo_codigo=6476501) -> THIAGO CORREIA SILVA
 *      task.task_type_exclusive_executor_id (precedencia nivel 3)
 *   2. INDENIZACAO PMMB (TEMA) -> THAISE
 *      task.theme_exclusive_executor_id (precedencia nivel 2)
 *   3. TEMFC (TEMA) -> Ana Patricia Cruz
 *      task.theme_exclusive_executor_id (precedencia nivel 2)
 *
 * Os uuids abaixo sao os EXATOS resolvidos de system_projuris_executor_mapping
 * (uuid_v5 deterministico do codigo ProJuris). Assim o teste espelha o que o
 * transformer do dry-run popula a partir de *_mapping.exclusive_executor_id.
 */

import { assertEquals } from 'jsr:@std/assert@1';
import { selectFlow } from '../flow-selector.ts';
import { makeTask, DEFAULT_PROCESS } from './fixtures.ts';

const THIAGO = 'fd1ae6da-2097-571f-a2f3-4c159bf1e30a'; // 128858
const THAISE = 'ddd294bb-f630-50fc-b74f-1ad5a5bbede1'; // 204546
const ANA    = '46a3b534-24bf-53a5-9397-e1fdba415bf4'; // 131021

Deno.test('EXC-1: Audiencia (TIPO exclusivo) -> ABSOLUTE + THIAGO', () => {
  const task = makeTask({
    task_type_id: 'AUDIENCIA',
    task_type_exclusive_executor_id: THIAGO,
    // complexidade > 0 de proposito: prova que ABSOLUTE ignora COMPLEX/GENERAL
    task_type_complexity_level: 2,
  });
  const decision = selectFlow(task, DEFAULT_PROCESS, 2);
  assertEquals(decision.flow, 'ABSOLUTE');
  if (decision.flow === 'ABSOLUTE') assertEquals(decision.executorId, THIAGO);
});

Deno.test('EXC-2: INDENIZACAO PMMB (TEMA exclusivo) -> ABSOLUTE + THAISE', () => {
  const task = makeTask({
    theme_id: 'INDENIZACAO_PMMB',
    theme_exclusive_executor_id: THAISE,
  });
  const decision = selectFlow(task, DEFAULT_PROCESS, 0);
  assertEquals(decision.flow, 'ABSOLUTE');
  if (decision.flow === 'ABSOLUTE') assertEquals(decision.executorId, THAISE);
});

Deno.test('EXC-3: TEMFC (TEMA exclusivo) -> ABSOLUTE + Ana Patricia', () => {
  const task = makeTask({
    theme_id: 'TEMFC',
    theme_exclusive_executor_id: ANA,
  });
  const decision = selectFlow(task, DEFAULT_PROCESS, 1);
  assertEquals(decision.flow, 'ABSOLUTE');
  if (decision.flow === 'ABSOLUTE') assertEquals(decision.executorId, ANA);
});

Deno.test('EXC-precedencia: TEMA (nivel 2) vence TIPO (nivel 3) quando ambos exclusivos', () => {
  // Sanidade: se uma tarefa fosse Audiencia E tema exclusivo, o tema (nivel 2)
  // tem precedencia sobre o tipo (nivel 3), conforme flow-selector.
  const task = makeTask({
    theme_exclusive_executor_id: THAISE,
    task_type_exclusive_executor_id: THIAGO,
  });
  const decision = selectFlow(task, DEFAULT_PROCESS, 0);
  assertEquals(decision.flow, 'ABSOLUTE');
  if (decision.flow === 'ABSOLUTE') assertEquals(decision.executorId, THAISE);
});
