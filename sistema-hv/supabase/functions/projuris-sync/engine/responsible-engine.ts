/**
 * Responsible Engine — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Atribuicao de executores as tarefas: preferencia historica, filas de credito
 * (proporcional geral / igual complexa), selecao de candidato e debito.
 *
 * Pure functions — sem efeitos colaterais. QueueState nunca e mutado in-place.
 *
 * Referencia: regras_motor_distribuicao_v1.0.yaml, secoes
 * `responsible_engine`, `preference`
 *
 * Story 1.5 — Epic 1
 */

import type {
  Executor,
  PreferenceHistory,
  QueueState,
  CalendarDay,
  DistributionFlow,
} from '../config/types.ts';
import type { ScoredTask } from './scoring.ts';

// ---------------------------------------------------------------------------
// Tipos de saida
// ---------------------------------------------------------------------------

export interface ResponsibleResult {
  executor_id: string;
  preference_applied: boolean;
  updated_queue_state: QueueState;
  alerts: string[];
}

// ---------------------------------------------------------------------------
// Helpers — deep copy imutavel (AC-16)
// ---------------------------------------------------------------------------

function cloneQueueState(qs: QueueState): QueueState {
  return {
    general_balances: { ...qs.general_balances },
    complex_balances: { ...qs.complex_balances },
    rotating_order: [...qs.rotating_order],
  };
}

function toDecimal4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Elegibilidade
// ---------------------------------------------------------------------------

/**
 * Filtra executores elegiveis para a tarefa na data final.
 */
export function getEligibleExecutors(
  executors: Executor[],
  taskTypeId: string,
  themeId: string,
  finalDate: string,
  flow: DistributionFlow,
  calendar: CalendarDay[],
): Executor[] {
  // Executores bloqueados individualmente na data final
  const blockedOnDate = new Set<string>();
  for (const day of calendar) {
    if (day.date === finalDate) {
      for (const eid of day.blocked_executor_ids) {
        blockedOnDate.add(eid);
      }
    }
  }

  return executors.filter((e) => {
    if (!e.active) return false;
    if (blockedOnDate.has(e.executor_id)) return false;

    // Autorizacao por tipo de tarefa (se lista nao vazia, deve conter o tipo)
    if (e.authorized_task_types.length > 0 && !e.authorized_task_types.includes(taskTypeId)) {
      return false;
    }

    // Autorizacao por tema (se lista nao vazia, deve conter o tema)
    if (e.authorized_themes.length > 0 && !e.authorized_themes.includes(themeId)) {
      return false;
    }

    // Para fila complexa, exige complex_eligible
    if (flow === 'COMPLEX' && !e.complex_eligible) return false;

    // Para fila geral, exige peso > 0
    if (flow === 'GENERAL' && e.general_weight <= 0) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Preferencia historica (AC-01)
// ---------------------------------------------------------------------------

/**
 * Busca os 2 primeiros executores que completaram tarefa relevante no mesmo processo.
 * Retorna o primeiro elegivel, ou null se nenhum for elegivel.
 *
 * spec: preference.eligible_positions = [1, 2]
 * spec: preference.source = last_completed_relevant_task_same_process
 */
export function checkPreference(
  processId: string,
  preferenceHistory: PreferenceHistory[],
  eligibleExecutorIds: string[],
): { executorId: string | null; preferenceApplied: boolean } {
  // Filtrar historico relevante para este processo, ordenar por completion_date ASC
  const relevant = preferenceHistory
    .filter((h) => h.process_id === processId && h.relevant)
    .sort((a, b) => a.completion_date.localeCompare(b.completion_date));

  if (relevant.length === 0) {
    return { executorId: null, preferenceApplied: false };
  }

  // Extrair os 2 primeiros executores unicos (posicoes 1 e 2)
  const seen = new Set<string>();
  const firstTwo: string[] = [];
  for (const h of relevant) {
    if (!seen.has(h.executor_id)) {
      seen.add(h.executor_id);
      firstTwo.push(h.executor_id);
      if (firstTwo.length >= 2) break;
    }
  }

  // Verificar elegibilidade
  const eligibleSet = new Set(eligibleExecutorIds);
  for (const eid of firstTwo) {
    if (eligibleSet.has(eid)) {
      return { executorId: eid, preferenceApplied: true };
    }
  }

  return { executorId: null, preferenceApplied: false };
}

// ---------------------------------------------------------------------------
// Credito — Fila Geral (AC-02)
// ---------------------------------------------------------------------------

/**
 * Distribui credito proporcional na fila geral.
 * credit = final_points * executor_weight / sum_eligible_weights
 *
 * Executores inelegiveis: saldo preservado, nao recebem credito.
 */
export function creditGeneralQueue(
  taskPoints: number,
  eligibleExecutors: Executor[],
  queueState: QueueState,
): QueueState {
  const newState = cloneQueueState(queueState);

  if (eligibleExecutors.length === 0) return newState;

  const sumWeights = eligibleExecutors.reduce((sum, e) => sum + e.general_weight, 0);
  if (sumWeights <= 0) return newState;

  for (const e of eligibleExecutors) {
    const credit = toDecimal4(taskPoints * e.general_weight / sumWeights);
    const currentBalance = newState.general_balances[e.executor_id] ?? 0;
    newState.general_balances[e.executor_id] = toDecimal4(currentBalance + credit);
  }

  return newState;
}

// ---------------------------------------------------------------------------
// Credito — Fila Complexa (AC-03)
// ---------------------------------------------------------------------------

/**
 * Distribui credito igual na fila complexa.
 * credit = final_points / eligible_executor_count
 *
 * Executores inelegiveis: saldo preservado, nao recebem credito.
 */
export function creditComplexQueue(
  taskPoints: number,
  eligibleExecutors: Executor[],
  queueState: QueueState,
): QueueState {
  const newState = cloneQueueState(queueState);

  if (eligibleExecutors.length === 0) return newState;

  const credit = toDecimal4(taskPoints / eligibleExecutors.length);

  for (const e of eligibleExecutors) {
    const currentBalance = newState.complex_balances[e.executor_id] ?? 0;
    newState.complex_balances[e.executor_id] = toDecimal4(currentBalance + credit);
  }

  return newState;
}

// ---------------------------------------------------------------------------
// Selecao de candidato (AC-04)
// ---------------------------------------------------------------------------

/**
 * Seleciona o executor candidato por:
 * 1. Maior saldo na fila
 * 2. Menor carga no dia selecionado
 * 3. Ordem rotativa de desempate
 */
export function selectCandidate(
  eligibleExecutors: Executor[],
  balances: Record<string, number>,
  dayLoads: Record<string, number>,
  rotatingOrder: string[],
): string {
  if (eligibleExecutors.length === 1) {
    return eligibleExecutors[0].executor_id;
  }

  // Ordenar por criterios de selecao
  const sorted = [...eligibleExecutors].sort((a, b) => {
    const balA = balances[a.executor_id] ?? 0;
    const balB = balances[b.executor_id] ?? 0;

    // 1. Maior saldo primeiro
    if (balA !== balB) return balB - balA;

    // 2. Menor carga no dia
    const loadA = dayLoads[a.executor_id] ?? 0;
    const loadB = dayLoads[b.executor_id] ?? 0;
    if (loadA !== loadB) return loadA - loadB;

    // 3. Ordem rotativa (quem aparece primeiro no array tem prioridade)
    const idxA = rotatingOrder.indexOf(a.executor_id);
    const idxB = rotatingOrder.indexOf(b.executor_id);
    const posA = idxA === -1 ? Infinity : idxA;
    const posB = idxB === -1 ? Infinity : idxB;
    return posA - posB;
  });

  return sorted[0].executor_id;
}

// ---------------------------------------------------------------------------
// Debito do selecionado (AC-05)
// ---------------------------------------------------------------------------

/**
 * Debita o executor selecionado: new_balance = old_balance - task_points
 */
export function debitExecutor(
  executorId: string,
  taskPoints: number,
  queueState: QueueState,
  flow: DistributionFlow,
): QueueState {
  const newState = cloneQueueState(queueState);

  const balances = flow === 'COMPLEX' ? newState.complex_balances : newState.general_balances;
  const currentBalance = balances[executorId] ?? 0;
  balances[executorId] = toDecimal4(currentBalance - taskPoints);

  return newState;
}

// ---------------------------------------------------------------------------
// Ordem rotativa (AC-06)
// ---------------------------------------------------------------------------

/**
 * Move o executor selecionado para o final da fila rotativa.
 */
export function updateRotatingOrder(
  executorId: string,
  rotatingOrder: string[],
): string[] {
  const newOrder = rotatingOrder.filter((id) => id !== executorId);
  newOrder.push(executorId);
  return newOrder;
}

// ---------------------------------------------------------------------------
// Orquestrador — assignResponsible (AC-07)
// ---------------------------------------------------------------------------

/**
 * Orquestra a atribuicao de responsavel para uma tarefa:
 * 1. Verifica preferencia historica
 * 2. Se sem preferencia, credita fila (geral ou complexa)
 * 3. Seleciona candidato
 * 4. Debita o selecionado
 * 5. Atualiza ordem rotativa
 */
export function assignResponsible(
  task: ScoredTask,
  processId: string,
  taskTypeId: string,
  themeId: string,
  flow: DistributionFlow,
  finalDate: string,
  executors: Executor[],
  preferenceHistory: PreferenceHistory[],
  queueState: QueueState,
  dayLoads: Record<string, number>,
  calendar: CalendarDay[],
): ResponsibleResult {
  const alerts: string[] = [];

  // Filtrar elegiveis
  const eligible = getEligibleExecutors(executors, taskTypeId, themeId, finalDate, flow, calendar);

  if (eligible.length === 0) {
    alerts.push('ALT-RESP-002'); // blocking: nenhum executor elegivel
    return {
      executor_id: '',
      preference_applied: false,
      updated_queue_state: cloneQueueState(queueState),
      alerts,
    };
  }

  const eligibleIds = eligible.map((e) => e.executor_id);

  // 1. ABSOLUTE: nao usa fila nem preferencia (spec: absolute.uses_queue=false, uses_preference=false)
  if (flow === 'ABSOLUTE') {
    // Para ABSOLUTE, o executor ja vem determinado pelo fluxo de selecao (Story 1.6)
    // Aqui so retornamos o primeiro elegivel (o caller ja filtra o executor correto)
    const selectedId = eligible[0].executor_id;
    const newOrder = updateRotatingOrder(selectedId, queueState.rotating_order);
    return {
      executor_id: selectedId,
      preference_applied: false,
      updated_queue_state: { ...cloneQueueState(queueState), rotating_order: newOrder },
      alerts,
    };
  }

  // 2. Verificar preferencia (COMPLEX e GENERAL)
  const { executorId: preferredId, preferenceApplied } = checkPreference(
    processId, preferenceHistory, eligibleIds
  );

  if (preferredId) {
    // Preferencial encontrado e elegivel — credita, debita e retorna
    let state = flow === 'COMPLEX'
      ? creditComplexQueue(task.final_points, eligible, queueState)
      : creditGeneralQueue(task.final_points, eligible, queueState);

    state = debitExecutor(preferredId, task.final_points, state, flow);
    state.rotating_order = updateRotatingOrder(preferredId, state.rotating_order);

    return {
      executor_id: preferredId,
      preference_applied: true,
      updated_queue_state: state,
      alerts,
    };
  }

  // 3. Sem preferencia — creditar fila e selecionar candidato
  let state: QueueState;
  let balances: Record<string, number>;

  if (flow === 'COMPLEX') {
    state = creditComplexQueue(task.final_points, eligible, queueState);
    balances = state.complex_balances;
  } else {
    state = creditGeneralQueue(task.final_points, eligible, queueState);
    balances = state.general_balances;
  }

  // 4. Selecionar candidato
  const selectedId = selectCandidate(eligible, balances, dayLoads, state.rotating_order);

  // 5. Debitar selecionado
  state = debitExecutor(selectedId, task.final_points, state, flow);

  // 6. Atualizar ordem rotativa
  state.rotating_order = updateRotatingOrder(selectedId, state.rotating_order);

  return {
    executor_id: selectedId,
    preference_applied: preferenceApplied,
    updated_queue_state: state,
    alerts,
  };
}
