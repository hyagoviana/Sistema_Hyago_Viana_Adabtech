/**
 * Modulo de Scoring — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Pure functions para calculo de pontuacao de tarefas.
 * Sem efeitos colaterais — opera exclusivamente sobre dados de entrada.
 *
 * Referencia: regras_motor_distribuicao_v1.0.yaml, secao `scoring` e `classification`
 *
 * Story 1.3 — Epic 1
 */

import type { Task, Process, ComplexityLevel, TemporalLevel } from '../config/types.ts';

// ---------------------------------------------------------------------------
// Tipos de saida do scoring
// ---------------------------------------------------------------------------

export interface ScoringModifiers {
  collective: number;
  complexity: number;
  temporal: number;
}

export interface ScoredTask {
  task_id: string;
  base_points: number;
  modifiers: ScoringModifiers;
  total_modifier: number;
  final_points: number;
  final_complexity: ComplexityLevel;
  final_temporal: TemporalLevel;
}

// ---------------------------------------------------------------------------
// Constantes de modificadores (spec YAML)
// ---------------------------------------------------------------------------

const COLLECTIVE_MODIFIER: Record<string, number> = {
  false: 0.00,
  true: 0.20,
};

const COMPLEXITY_MODIFIER: Record<number, number> = {
  0: 0.00,
  1: 0.20,
  2: 0.30,
};

const TEMPORAL_MODIFIER: Record<number, number> = {
  0: 0.00,
  1: 0.10,
  2: 0.30,
};

const MAX_TOTAL_MODIFIER = 0.80;

// ---------------------------------------------------------------------------
// Aritmetica decimal segura (NFR-004: 4 casas internas)
// ---------------------------------------------------------------------------

function toDecimal4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Classificacao final (spec YAML, secao `classification`)
// ---------------------------------------------------------------------------

/**
 * Calcula complexidade final: max(process, theme, task_type, task_override)
 * AC-05
 */
export function calculateFinalComplexity(task: Task, process: Process): ComplexityLevel {
  return Math.max(
    process.complexity_level,
    task.theme_complexity_level,
    task.task_type_complexity_level,
    task.task_override_complexity_level,
  ) as ComplexityLevel;
}

/**
 * Calcula temporalidade final: max(process, theme, task_type, task_override)
 * Urgente (2) sobrepoe prioritario (1) naturalmente via max.
 * AC-06
 */
export function calculateFinalTemporal(task: Task, process: Process): TemporalLevel {
  return Math.max(
    process.temporal_level,
    task.theme_temporal_level,
    task.task_type_temporal_level,
    task.task_override_temporal_level,
  ) as TemporalLevel;
}

// ---------------------------------------------------------------------------
// Funcoes de scoring
// ---------------------------------------------------------------------------

/**
 * Calcula pontos base: task_type_points * theme_multiplier
 * AC-01
 */
export function calculateBasePoints(task: Task): number {
  return toDecimal4(task.task_type_points * task.theme_multiplier);
}

/**
 * Calcula modificadores individuais baseado na tarefa e processo.
 * AC-02
 */
export function calculateModifiers(
  task: Task,
  process: Process,
  finalComplexity: ComplexityLevel,
  finalTemporal: TemporalLevel,
): ScoringModifiers {
  return {
    collective: COLLECTIVE_MODIFIER[String(process.collective)] ?? 0,
    complexity: COMPLEXITY_MODIFIER[finalComplexity] ?? 0,
    temporal: TEMPORAL_MODIFIER[finalTemporal] ?? 0,
  };
}

/**
 * Calcula pontos finais: base * (1 + min(sum_modifiers, 0.80))
 * AC-03, AC-04
 */
export function calculateFinalPoints(basePoints: number, modifiers: ScoringModifiers): number {
  const rawTotal = toDecimal4(modifiers.collective + modifiers.complexity + modifiers.temporal);
  const totalModifier = Math.min(rawTotal, MAX_TOTAL_MODIFIER);
  return toDecimal4(basePoints * (1 + totalModifier));
}

// ---------------------------------------------------------------------------
// Funcao principal — scoreTask (AC-11)
// ---------------------------------------------------------------------------

/**
 * Calcula scoring completo de uma tarefa.
 * Pure function: mesma entrada sempre produz mesma saida.
 */
export function scoreTask(task: Task, process: Process): ScoredTask {
  const finalComplexity = calculateFinalComplexity(task, process);
  const finalTemporal = calculateFinalTemporal(task, process);

  const basePoints = calculateBasePoints(task);
  const modifiers = calculateModifiers(task, process, finalComplexity, finalTemporal);

  const rawTotal = toDecimal4(modifiers.collective + modifiers.complexity + modifiers.temporal);
  const totalModifier = Math.min(rawTotal, MAX_TOTAL_MODIFIER);
  const finalPoints = toDecimal4(basePoints * (1 + totalModifier));

  return {
    task_id: task.task_id,
    base_points: basePoints,
    modifiers,
    total_modifier: toDecimal4(totalModifier),
    final_points: finalPoints,
    final_complexity: finalComplexity,
    final_temporal: finalTemporal,
  };
}
