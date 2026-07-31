/**
 * Fixtures de teste — Motor de Distribuicao v1.0
 *
 * Dados base reutilizaveis para os 36 cenarios de aceite.
 * Todos os testes devem usar estas fixtures como ponto de partida,
 * sobrescrevendo apenas os campos relevantes para cada cenario.
 */

import type {
  BatchInput,
  Batch,
  Executor,
  CalendarDay,
  Process,
  Task,
  PreferenceHistory,
  QueueState,
} from '../../config/types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gera calendario operacional sem bloqueios (seg-sex) para N dias a partir de uma data */
export function generateCalendar(startDate: string, days: number): CalendarDay[] {
  const calendar: CalendarDay[] = [];
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dow = date.getDay();
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    calendar.push({
      date: iso,
      globally_operational: dow >= 1 && dow <= 5,
      initial_team_points: 0,
      blocked_executor_ids: [],
    });
  }

  return calendar;
}

// ---------------------------------------------------------------------------
// Executores padrao
// ---------------------------------------------------------------------------

export const EXEC_A: Executor = {
  executor_id: 'exec-a',
  active: true,
  general_weight: 100,
  complex_eligible: true,
  authorized_task_types: [],
  authorized_themes: [],
};

export const EXEC_B: Executor = {
  executor_id: 'exec-b',
  active: true,
  general_weight: 100,
  complex_eligible: true,
  authorized_task_types: [],
  authorized_themes: [],
};

export const EXEC_C: Executor = {
  executor_id: 'exec-c',
  active: true,
  general_weight: 50,
  complex_eligible: true,
  authorized_task_types: [],
  authorized_themes: [],
};

// ---------------------------------------------------------------------------
// Processo padrao
// ---------------------------------------------------------------------------

export const DEFAULT_PROCESS: Process = {
  process_id: 'proc-1',
  theme_id: 'theme-1',
  collective: false,
  complexity_level: 0,
  temporal_level: 0,
  directed_executor_id: null,
};

// ---------------------------------------------------------------------------
// Tarefa padrao
// ---------------------------------------------------------------------------

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-1',
    process_id: 'proc-1',
    task_type_id: 'type-1',
    theme_id: 'theme-1',
    task_type_points: 10,
    theme_multiplier: 1.0,
    task_type_complexity_level: 0,
    task_type_temporal_level: 0,
    task_override_complexity_level: 0,
    task_override_temporal_level: 0,
    theme_complexity_level: 0,
    theme_temporal_level: 0,
    theme_exclusive_executor_id: null,
    task_type_exclusive_executor_id: null,
    fatal_date: '2026-08-15',
    internal_limit_date: '2026-08-12',
    input_order: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// QueueState vazio
// ---------------------------------------------------------------------------

export const EMPTY_QUEUE: QueueState = {
  general_balances: {},
  complex_balances: {},
  rotating_order: ['exec-a', 'exec-b', 'exec-c'],
};

// ---------------------------------------------------------------------------
// Batch padrao
// ---------------------------------------------------------------------------

export const DEFAULT_BATCH: Batch = {
  batch_id: 'test-batch-001',
  distribution_date: '2026-07-28', // segunda-feira
  mode: 'HIGH_PRODUCTION',
  general_average_90d: 10,
};

// ---------------------------------------------------------------------------
// BatchInput completo padrao
// ---------------------------------------------------------------------------

export function makeBatchInput(overrides: Partial<BatchInput> = {}): BatchInput {
  return {
    batch: DEFAULT_BATCH,
    executors: [EXEC_A, EXEC_B, EXEC_C],
    calendar: generateCalendar('2026-07-27', 45),
    processes: [DEFAULT_PROCESS],
    tasks: [makeTask()],
    preference_history: [],
    queue_state: { ...EMPTY_QUEUE, general_balances: {}, complex_balances: {}, rotating_order: ['exec-a', 'exec-b', 'exec-c'] },
    ...overrides,
  };
}
