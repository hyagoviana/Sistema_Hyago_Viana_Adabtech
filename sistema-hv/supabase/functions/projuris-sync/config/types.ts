/**
 * Contrato de Dados — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Tipos TypeScript alinhados ao JSON Schema v1.0.
 * Compativel com Deno (sem dependencias Node-only).
 *
 * Story 1.2 — Epic 1
 */

// ---------------------------------------------------------------------------
// Enums / Literais
// ---------------------------------------------------------------------------

export type DistributionFlow = 'ABSOLUTE' | 'COMPLEX' | 'GENERAL';
export type OperationMode = 'HIGH_PRODUCTION' | 'HIGH_CONTROL';
export type ComplexityLevel = 0 | 1 | 2;
export type TemporalLevel = 0 | 1 | 2;

export const DISTRIBUTION_FLOWS = ['ABSOLUTE', 'COMPLEX', 'GENERAL'] as const;
export const OPERATION_MODES = ['HIGH_PRODUCTION', 'HIGH_CONTROL'] as const;
export const COMPLEXITY_LEVELS = [0, 1, 2] as const;
export const TEMPORAL_LEVELS = [0, 1, 2] as const;

// ---------------------------------------------------------------------------
// Executor (AC-01)
// ---------------------------------------------------------------------------

export interface Executor {
  executor_id: string;
  active: boolean;
  general_weight: number;
  complex_eligible: boolean;
  authorized_task_types: string[];
  authorized_themes: string[];
}

// ---------------------------------------------------------------------------
// CalendarDay (AC-02)
// ---------------------------------------------------------------------------

export interface CalendarDay {
  date: string; // ISO date YYYY-MM-DD
  globally_operational: boolean;
  initial_team_points: number;
  blocked_executor_ids: string[];
  reason?: string | null;
}

// ---------------------------------------------------------------------------
// Process (AC-03)
// ---------------------------------------------------------------------------

export interface Process {
  process_id: string;
  theme_id: string;
  collective: boolean;
  complexity_level: ComplexityLevel;
  temporal_level: TemporalLevel;
  directed_executor_id?: string | null;
}

// ---------------------------------------------------------------------------
// Task (AC-04)
// ---------------------------------------------------------------------------

export interface Task {
  task_id: string;
  process_id: string;
  task_type_id: string;
  theme_id: string;
  task_type_points: number;
  theme_multiplier: number;
  task_type_complexity_level: ComplexityLevel;
  task_type_temporal_level: TemporalLevel;
  task_override_complexity_level: ComplexityLevel;
  task_override_temporal_level: ComplexityLevel;
  theme_complexity_level: ComplexityLevel;
  theme_temporal_level: TemporalLevel;
  theme_exclusive_executor_id?: string | null;
  task_type_exclusive_executor_id?: string | null;
  fatal_date: string; // ISO date
  internal_limit_date: string; // ISO date
  input_order: number;
}

// ---------------------------------------------------------------------------
// PreferenceHistory (AC-05)
// ---------------------------------------------------------------------------

export interface PreferenceHistory {
  process_id: string;
  task_type_id: string;
  executor_id: string;
  completion_date: string; // ISO datetime
  relevant: boolean;
}

// ---------------------------------------------------------------------------
// QueueState (AC-06)
// ---------------------------------------------------------------------------

export interface QueueState {
  general_balances: Record<string, number>;
  complex_balances: Record<string, number>;
  rotating_order: string[];
}

// ---------------------------------------------------------------------------
// BatchInput (AC-07) — Entrada raiz do Motor
// ---------------------------------------------------------------------------

export interface Batch {
  batch_id: string;
  distribution_date: string; // ISO date
  mode: OperationMode;
  general_average_90d: number;
  timezone?: 'America/Sao_Paulo';
}

export interface BatchInput {
  batch: Batch;
  executors: Executor[];
  calendar: CalendarDay[];
  processes: Process[];
  tasks: Task[];
  preference_history: PreferenceHistory[];
  queue_state: QueueState;
}

// ---------------------------------------------------------------------------
// TaskResult (AC-08) — Resultado por tarefa
// ---------------------------------------------------------------------------

export interface TaskResult {
  task_id: string;
  process_id: string;
  distribution_date: string; // ISO date
  final_points: number;
  flow: DistributionFlow;
  base_date: string; // ISO date
  applicable_limit: string; // ISO date
  preferred_date: string | null; // ISO date
  final_date: string; // ISO date
  executor_id: string;
  preference_applied: boolean;
  alerts: string[];
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// BatchOutput (AC-09) — Saida do Motor
// ---------------------------------------------------------------------------

export interface BatchMetrics {
  duration_ms: number;
  total_tasks: number;
  successful: number;
  failed: number;
}

export interface BatchOutput {
  batch_id: string;
  distribution_date: string; // ISO date
  task_results: TaskResult[];
  updated_queue_state: QueueState;
  alerts_summary: Record<string, number>;
  metrics: BatchMetrics;
}
