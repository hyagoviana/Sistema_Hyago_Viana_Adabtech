/**
 * Flow Selector — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Seleciona o fluxo de atribuicao: ABSOLUTE, COMPLEX ou GENERAL.
 * Detecta precedencia absoluta e duplicatas no mesmo nivel.
 *
 * Referencia: regras_motor_distribuicao_v1.0.yaml, secoes
 * `absolute_precedence`, `flow_selection`
 *
 * Story 1.6 — Epic 1
 */

import type {
  Task,
  Process,
  Executor,
  CalendarDay,
  ComplexityLevel,
} from '../config/types.ts';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type FlowDecision =
  | { flow: 'ABSOLUTE'; executorId: string }
  | { flow: 'COMPLEX' }
  | { flow: 'GENERAL' }
  | { flow: 'BLOCKED'; alert: string };

export interface AbsoluteResult {
  executorId: string;
  level: 'process_directed' | 'theme_exclusive' | 'task_type_exclusive';
}

// ---------------------------------------------------------------------------
// Deteccao de responsavel absoluto (AC-01, AC-02)
// ---------------------------------------------------------------------------

/**
 * Detecta responsavel absoluto por ordem de precedencia:
 * 1. process.directed_executor_id
 * 2. task.theme_exclusive_executor_id
 * 3. task.task_type_exclusive_executor_id
 *
 * Retorna o primeiro encontrado, ou null se nenhum.
 * Se duplicata no mesmo nivel, retorna BLOCKED + ALT-CAD-001.
 */
export function detectAbsoluteResponsible(
  task: Task,
  process: Process,
): AbsoluteResult | { blocked: true; alert: string } | null {
  // Nivel 1: Processo direcionado
  if (process.directed_executor_id) {
    return {
      executorId: process.directed_executor_id,
      level: 'process_directed',
    };
  }

  // Nivel 2: Tema exclusivo
  if (task.theme_exclusive_executor_id) {
    return {
      executorId: task.theme_exclusive_executor_id,
      level: 'theme_exclusive',
    };
  }

  // Nivel 3: Tipo de tarefa exclusivo
  if (task.task_type_exclusive_executor_id) {
    return {
      executorId: task.task_type_exclusive_executor_id,
      level: 'task_type_exclusive',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Verificacao de elegibilidade do executor absoluto (AC-11)
// ---------------------------------------------------------------------------

/**
 * Verifica se o executor absoluto esta ativo e sem bloqueio individual na data.
 * Se inelegivel, retorna false (caller deve gerar ALT-RESP-001).
 */
export function isAbsoluteExecutorEligible(
  executorId: string,
  executors: Executor[],
  finalDate: string,
  calendar: CalendarDay[],
): boolean {
  // Verificar se executor existe e esta ativo
  const executor = executors.find((e) => e.executor_id === executorId);
  if (!executor || !executor.active) return false;

  // Verificar bloqueio individual na data
  for (const day of calendar) {
    if (day.date === finalDate && day.blocked_executor_ids.includes(executorId)) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Selecao de fluxo (AC-03)
// ---------------------------------------------------------------------------

/**
 * Seleciona o fluxo de atribuicao:
 * - ABSOLUTE: se responsavel absoluto encontrado
 * - COMPLEX: se final_complexity in [1, 2] sem absoluto
 * - GENERAL: se final_complexity == 0 sem absoluto
 * - BLOCKED: se duplicata de absoluto no mesmo nivel
 */
export function selectFlow(
  task: Task,
  process: Process,
  finalComplexity: ComplexityLevel,
): FlowDecision {
  const absolute = detectAbsoluteResponsible(task, process);

  if (absolute !== null) {
    // Verificar se e bloqueio por duplicata
    if ('blocked' in absolute) {
      return { flow: 'BLOCKED', alert: absolute.alert };
    }

    return { flow: 'ABSOLUTE', executorId: absolute.executorId };
  }

  // Sem absoluto — classificar por complexidade
  if (finalComplexity === 1 || finalComplexity === 2) {
    return { flow: 'COMPLEX' };
  }

  return { flow: 'GENERAL' };
}
