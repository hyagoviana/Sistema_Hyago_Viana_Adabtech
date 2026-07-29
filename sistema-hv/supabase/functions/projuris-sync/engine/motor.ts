/**
 * Motor de Distribuicao — Orquestrador v1.0
 *
 * Integra scoring, date engine, flow selector, responsible engine e alertas
 * em funcoes puras: distributeTask() e distributeBatch().
 *
 * Determinista, parametros congelados, processamento sequencial.
 *
 * Referencia: regras_motor_distribuicao_v1.0.yaml, secoes `execution`, `responsible_engine`
 *
 * Story 1.8 — Epic 1
 */

import type {
  BatchInput,
  BatchOutput,
  Task,
  Process,
  Executor,
  CalendarDay,
  PreferenceHistory,
  QueueState,
  TaskResult,
  OperationMode,
  DistributionFlow,
} from '../config/types.ts';
import { scoreTask, type ScoredTask } from './scoring.ts';
import {
  calculateBaseDate,
  calculateApplicableLimit,
  calculatePreferredDate,
  findAssignmentDate,
  buildExecutorBlockedDates,
  calculateDayLoad,
} from './date-engine.ts';
import { buildGeneralBlockSet } from '../utils/date-utils.ts';
import { selectFlow, isAbsoluteExecutorEligible } from './flow-selector.ts';
import { assignResponsible, getEligibleExecutors } from './responsible-engine.ts';
import { generateAlerts, hasBlockingAlert, alertCodes, type Alert } from './alerts.ts';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface MotorContext {
  executors: Executor[];
  calendar: CalendarDay[];
  processes: Map<string, Process>;
  preferenceHistory: PreferenceHistory[];
  queueState: QueueState;
  /** executor_id -> date -> accumulated points */
  dayLoads: Map<string, Map<string, number>>;
  mode: OperationMode;
  distributionDate: string;
  m90: number;
  /** Task results acumulados no batch atual (para occupancy) */
  batchResults: TaskResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDayLoadsForDate(
  dayLoads: Map<string, Map<string, number>>,
  date: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [execId, dateMap] of dayLoads) {
    result[execId] = dateMap.get(date) ?? 0;
  }
  return result;
}

function addToDayLoad(
  dayLoads: Map<string, Map<string, number>>,
  executorId: string,
  date: string,
  points: number,
): void {
  if (!dayLoads.has(executorId)) {
    dayLoads.set(executorId, new Map());
  }
  const dateMap = dayLoads.get(executorId)!;
  dateMap.set(date, (dateMap.get(date) ?? 0) + points);
}

// ---------------------------------------------------------------------------
// Pre-ordenacao de tarefas (AC-03)
// ---------------------------------------------------------------------------

const FLOW_ORDER: Record<string, number> = { ABSOLUTE: 0, COMPLEX: 1, GENERAL: 2 };
const TEMPORAL_ORDER: Record<number, number> = { 2: 0, 1: 1, 0: 2 }; // urgent first

/**
 * Ordena tarefas para processamento conforme FR-018.
 * Como final_date nao esta calculada, usa internal_limit_date como proxy.
 * Ordem: temporal(urgent first) > flow_proxy(complexity) > internal_limit > input_order
 */
function sortTasksForProcessing(
  tasks: Task[],
  processes: Map<string, Process>,
): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = processes.get(a.process_id);
    const pb = processes.get(b.process_id);

    // 1. Temporal: urgent (2) primeiro
    const ta = Math.max(
      pa?.temporal_level ?? 0, a.task_type_temporal_level,
      a.task_override_temporal_level, a.theme_temporal_level
    );
    const tb = Math.max(
      pb?.temporal_level ?? 0, b.task_type_temporal_level,
      b.task_override_temporal_level, b.theme_temporal_level
    );
    const tempA = TEMPORAL_ORDER[ta] ?? 2;
    const tempB = TEMPORAL_ORDER[tb] ?? 2;
    if (tempA !== tempB) return tempA - tempB;

    // 2. Flow proxy: complexidade (1,2 = COMPLEX antes de 0 = GENERAL)
    const ca = Math.max(
      pa?.complexity_level ?? 0, a.task_type_complexity_level,
      a.task_override_complexity_level, a.theme_complexity_level
    );
    const cb = Math.max(
      pb?.complexity_level ?? 0, b.task_type_complexity_level,
      b.task_override_complexity_level, b.theme_complexity_level
    );
    // Absoluto vem antes de tudo, mas detectamos via directed/exclusive
    const hasAbsA = !!(pa?.directed_executor_id || a.theme_exclusive_executor_id || a.task_type_exclusive_executor_id);
    const hasAbsB = !!(pb?.directed_executor_id || b.theme_exclusive_executor_id || b.task_type_exclusive_executor_id);
    const flowA = hasAbsA ? 0 : (ca >= 1 ? 1 : 2);
    const flowB = hasAbsB ? 0 : (cb >= 1 ? 1 : 2);
    if (flowA !== flowB) return flowA - flowB;

    // 3. Earlier applicable limit (proxy: internal_limit_date)
    if (a.internal_limit_date !== b.internal_limit_date) {
      return a.internal_limit_date < b.internal_limit_date ? -1 : 1;
    }

    // 4. Earlier fatal
    if (a.fatal_date !== b.fatal_date) {
      return a.fatal_date < b.fatal_date ? -1 : 1;
    }

    // 5. Input order
    return a.input_order - b.input_order;
  });
}

// ---------------------------------------------------------------------------
// distributeTask (AC-01)
// ---------------------------------------------------------------------------

/**
 * Processa uma tarefa individual: score -> flow -> date -> responsible -> alerts.
 * Pure function exceto dayLoads que e mutado para tracking intra-batch.
 */
function distributeTask(
  task: Task,
  ctx: MotorContext,
): TaskResult {
  const process = ctx.processes.get(task.process_id);
  if (!process) {
    return makeBlockedResult(task, ctx.distributionDate, ['ALT-RESP-002']);
  }

  // 1. Scoring
  const scored = scoreTask(task, process);

  // 2. Flow selection
  const flowDecision = selectFlow(task, process, scored.final_complexity);

  if (flowDecision.flow === 'BLOCKED') {
    return makeBlockedResult(task, ctx.distributionDate, [flowDecision.alert]);
  }

  const flow: DistributionFlow = flowDecision.flow;
  const generalBlocks = buildGeneralBlockSet(ctx.calendar);
  const collectedAlerts: string[] = [];

  // 3. Date Engine — base date
  const { baseDate, alerts: baseAlerts } = calculateBaseDate(
    ctx.distributionDate, task.fatal_date, scored.final_temporal,
    flow === 'ABSOLUTE', generalBlocks,
  );
  collectedAlerts.push(...baseAlerts);

  // Check fatal blocking
  if (collectedAlerts.includes('ALT-PRAZO-002')) {
    return makeBlockedResult(task, ctx.distributionDate, collectedAlerts);
  }

  // 4. Applicable limit
  const { applicableLimit, alerts: limitAlerts } = calculateApplicableLimit(
    ctx.distributionDate, task.internal_limit_date, task.fatal_date,
    scored.final_temporal, generalBlocks,
  );
  collectedAlerts.push(...limitAlerts);

  // 5. Preferred date
  const preferredDate = calculatePreferredDate(
    baseDate, applicableLimit, scored.final_temporal, ctx.mode, generalBlocks,
  );

  // 6. Responsible assignment
  let executorId: string;
  let preferenceApplied = false;
  let updatedQueueState = ctx.queueState;

  if (flow === 'ABSOLUTE' && flowDecision.flow === 'ABSOLUTE') {
    executorId = flowDecision.executorId;

    // Check absolute executor eligibility across dates
    const blockedDates = buildExecutorBlockedDates(executorId, ctx.calendar);
    const finalDate = findAssignmentDate(
      baseDate, applicableLimit, preferredDate, scored.final_temporal,
      executorId, ctx.calendar, ctx.batchResults, ctx.m90, ctx.mode, blockedDates,
    );

    if (!isAbsoluteExecutorEligible(executorId, ctx.executors, finalDate, ctx.calendar)) {
      collectedAlerts.push('ALT-RESP-001');
      return makeBlockedResult(task, ctx.distributionDate, collectedAlerts);
    }

    // Update day load
    addToDayLoad(ctx.dayLoads, executorId, finalDate, scored.final_points);

    return {
      task_id: task.task_id,
      process_id: task.process_id,
      distribution_date: ctx.distributionDate,
      final_points: scored.final_points,
      flow,
      base_date: baseDate,
      applicable_limit: applicableLimit,
      preferred_date: preferredDate,
      final_date: finalDate,
      executor_id: executorId,
      preference_applied: false,
      alerts: collectedAlerts,
      blocked: false,
    };
  }

  // COMPLEX or GENERAL — use responsible engine
  const eligible = getEligibleExecutors(
    ctx.executors, task.task_type_id, task.theme_id, baseDate, flow, ctx.calendar,
  );

  if (eligible.length === 0) {
    collectedAlerts.push('ALT-RESP-002');
    return makeBlockedResult(task, ctx.distributionDate, collectedAlerts);
  }

  // Find final date for first candidate (approximate — will refine with actual executor)
  const blockedDates = buildExecutorBlockedDates(eligible[0].executor_id, ctx.calendar);
  const tentativeFinalDate = findAssignmentDate(
    baseDate, applicableLimit, preferredDate, scored.final_temporal,
    eligible[0].executor_id, ctx.calendar, ctx.batchResults, ctx.m90, ctx.mode, blockedDates,
  );

  const dayLoadsForDate = getDayLoadsForDate(ctx.dayLoads, tentativeFinalDate);

  const responsibleResult = assignResponsible(
    scored, task.process_id, task.task_type_id, task.theme_id,
    flow, tentativeFinalDate, ctx.executors, ctx.preferenceHistory,
    ctx.queueState, dayLoadsForDate, ctx.calendar,
  );

  collectedAlerts.push(...responsibleResult.alerts);

  if (!responsibleResult.executor_id) {
    collectedAlerts.push('ALT-RESP-002');
    return makeBlockedResult(task, ctx.distributionDate, collectedAlerts);
  }

  executorId = responsibleResult.executor_id;
  preferenceApplied = responsibleResult.preference_applied;
  ctx.queueState = responsibleResult.updated_queue_state;

  // Recalculate final date for the actual selected executor
  const selectedBlockedDates = buildExecutorBlockedDates(executorId, ctx.calendar);
  const finalDate = findAssignmentDate(
    baseDate, applicableLimit, preferredDate, scored.final_temporal,
    executorId, ctx.calendar, ctx.batchResults, ctx.m90, ctx.mode, selectedBlockedDates,
  );

  // Update day load (AC-05)
  addToDayLoad(ctx.dayLoads, executorId, finalDate, scored.final_points);

  // Final alerts based on final_date
  const finalAlerts = generateAlerts({
    task_id: task.task_id,
    distributionDate: ctx.distributionDate,
    fatalDate: task.fatal_date,
    internalLimitDate: task.internal_limit_date,
    finalDate,
    executorId,
    eligibleExecutorCount: eligible.length,
    existingAlertCodes: collectedAlerts,
  });

  const allAlertCodes = alertCodes(finalAlerts);

  return {
    task_id: task.task_id,
    process_id: task.process_id,
    distribution_date: ctx.distributionDate,
    final_points: scored.final_points,
    flow,
    base_date: baseDate,
    applicable_limit: applicableLimit,
    preferred_date: preferredDate,
    final_date: finalDate,
    executor_id: executorId,
    preference_applied: preferenceApplied,
    alerts: allAlertCodes,
    blocked: false,
  };
}

// ---------------------------------------------------------------------------
// distributeBatch (AC-02)
// ---------------------------------------------------------------------------

/**
 * Processa o batch completo de distribuicao.
 * Determinista: mesma entrada = mesma saida.
 */
export function distributeBatch(input: BatchInput): BatchOutput {
  const startTime = Date.now();

  // AC-04: Freeze — deep copy defensiva
  const frozen: BatchInput = JSON.parse(JSON.stringify(input));

  // Build lookup maps
  const processMap = new Map<string, Process>();
  for (const p of frozen.processes) {
    processMap.set(p.process_id, p);
  }

  // AC-03: Ordenar tarefas
  const sortedTasks = sortTasksForProcessing(frozen.tasks, processMap);

  // Contexto mutavel do batch
  const ctx: MotorContext = {
    executors: frozen.executors,
    calendar: frozen.calendar,
    processes: processMap,
    preferenceHistory: frozen.preference_history,
    queueState: { ...frozen.queue_state, general_balances: { ...frozen.queue_state.general_balances }, complex_balances: { ...frozen.queue_state.complex_balances }, rotating_order: [...frozen.queue_state.rotating_order] },
    dayLoads: new Map(),
    mode: frozen.batch.mode,
    distributionDate: frozen.batch.distribution_date,
    m90: frozen.batch.general_average_90d,
    batchResults: [],
  };

  // Initialize day loads from calendar initial_team_points (if any)
  // Not needed for initial batch — dayLoads starts empty

  const taskResults: TaskResult[] = [];
  let successful = 0;
  let failed = 0;
  const alertsSummary: Record<string, number> = {};

  // AC-02: Processamento sequencial
  for (const task of sortedTasks) {
    let result: TaskResult;

    try {
      // AC-11: try/catch por tarefa
      result = distributeTask(task, ctx);
    } catch (error) {
      // Erro inesperado — marcar como falha
      result = makeBlockedResult(task, ctx.distributionDate, ['ERROR']);
      result.alerts.push(`INTERNAL_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }

    taskResults.push(result);

    // AC-05, AC-06: dayLoad e queueState ja atualizados dentro de distributeTask

    // Add to batch results for occupancy calculation of next tasks
    ctx.batchResults.push(result);

    if (result.blocked) {
      failed++;
    } else {
      successful++;
    }

    // Aggregate alerts
    for (const code of result.alerts) {
      alertsSummary[code] = (alertsSummary[code] ?? 0) + 1;
    }
  }

  const duration = Date.now() - startTime;

  return {
    batch_id: frozen.batch.batch_id,
    distribution_date: frozen.batch.distribution_date,
    task_results: taskResults,
    updated_queue_state: ctx.queueState,
    alerts_summary: alertsSummary,
    metrics: {
      duration_ms: duration,
      total_tasks: sortedTasks.length,
      successful,
      failed,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper — resultado bloqueado
// ---------------------------------------------------------------------------

function makeBlockedResult(task: Task, distributionDate: string, alerts: string[]): TaskResult {
  return {
    task_id: task.task_id,
    process_id: task.process_id,
    distribution_date: distributionDate,
    final_points: 0,
    flow: 'GENERAL',
    base_date: distributionDate,
    applicable_limit: distributionDate,
    preferred_date: null,
    final_date: distributionDate,
    executor_id: '',
    preference_applied: false,
    alerts,
    blocked: true,
  };
}
