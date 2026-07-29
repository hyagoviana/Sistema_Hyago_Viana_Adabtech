/**
 * Schemas Zod — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Validacao em runtime do contrato de dados.
 * Compativel com Deno (import via npm:zod).
 *
 * Story 1.2 — Epic 1
 */

import { z } from 'npm:zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const isoDate = z.string().regex(isoDateRegex, 'Data deve estar no formato ISO YYYY-MM-DD');
const isoDateTime = z.string().regex(isoDateTimeRegex, 'Data deve estar no formato ISO datetime');
const complexityLevel = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const temporalLevel = z.union([z.literal(0), z.literal(1), z.literal(2)]);

// ---------------------------------------------------------------------------
// Executor (AC-01)
// ---------------------------------------------------------------------------

export const ExecutorSchema = z.object({
  executor_id: z.string().min(1),
  active: z.boolean(),
  general_weight: z.number().min(0),
  complex_eligible: z.boolean(),
  authorized_task_types: z.array(z.string()).default([]),
  authorized_themes: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// CalendarDay (AC-02)
// ---------------------------------------------------------------------------

export const CalendarDaySchema = z.object({
  date: isoDate,
  globally_operational: z.boolean(),
  initial_team_points: z.number().min(0).default(0),
  blocked_executor_ids: z.array(z.string()).default([]),
  reason: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Process (AC-03)
// ---------------------------------------------------------------------------

export const ProcessSchema = z.object({
  process_id: z.string(),
  theme_id: z.string(),
  collective: z.boolean(),
  complexity_level: complexityLevel,
  temporal_level: temporalLevel,
  directed_executor_id: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Task (AC-04)
// ---------------------------------------------------------------------------

export const TaskSchema = z.object({
  task_id: z.string(),
  process_id: z.string(),
  task_type_id: z.string(),
  theme_id: z.string(),
  task_type_points: z.number().positive(),
  theme_multiplier: z.number().positive(),
  task_type_complexity_level: complexityLevel.default(0),
  task_type_temporal_level: temporalLevel.default(0),
  task_override_complexity_level: complexityLevel.default(0),
  task_override_temporal_level: temporalLevel.default(0),
  theme_complexity_level: complexityLevel.default(0),
  theme_temporal_level: temporalLevel.default(0),
  theme_exclusive_executor_id: z.string().nullable().optional(),
  task_type_exclusive_executor_id: z.string().nullable().optional(),
  fatal_date: isoDate,
  internal_limit_date: isoDate,
  input_order: z.number().int().min(1),
});

// ---------------------------------------------------------------------------
// PreferenceHistory (AC-05)
// ---------------------------------------------------------------------------

export const PreferenceHistorySchema = z.object({
  process_id: z.string(),
  task_type_id: z.string(),
  executor_id: z.string(),
  completion_date: isoDateTime,
  relevant: z.boolean(),
});

// ---------------------------------------------------------------------------
// QueueState (AC-06)
// ---------------------------------------------------------------------------

export const QueueStateSchema = z.object({
  general_balances: z.record(z.string(), z.number()),
  complex_balances: z.record(z.string(), z.number()),
  rotating_order: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

export const BatchSchema = z.object({
  batch_id: z.string().min(1),
  distribution_date: isoDate,
  mode: z.enum(['HIGH_PRODUCTION', 'HIGH_CONTROL']),
  general_average_90d: z.number().positive(),
  timezone: z.literal('America/Sao_Paulo').optional(),
});

// ---------------------------------------------------------------------------
// BatchInput (AC-07 + AC-10) — Schema principal de entrada
// ---------------------------------------------------------------------------

export const BatchInputSchema = z.object({
  batch: BatchSchema,
  executors: z.array(ExecutorSchema).min(1),
  calendar: z.array(CalendarDaySchema),
  processes: z.array(ProcessSchema),
  tasks: z.array(TaskSchema).min(1),
  preference_history: z.array(PreferenceHistorySchema).default([]),
  queue_state: QueueStateSchema,
});

// ---------------------------------------------------------------------------
// TaskResult (AC-08 + AC-11)
// ---------------------------------------------------------------------------

export const TaskResultSchema = z.object({
  task_id: z.string(),
  process_id: z.string(),
  distribution_date: isoDate,
  final_points: z.number(),
  flow: z.enum(['ABSOLUTE', 'COMPLEX', 'GENERAL']),
  base_date: isoDate,
  applicable_limit: isoDate,
  preferred_date: isoDate.nullable(),
  final_date: isoDate,
  executor_id: z.string(),
  preference_applied: z.boolean(),
  alerts: z.array(z.string()),
  blocked: z.boolean(),
});

// ---------------------------------------------------------------------------
// BatchOutput (AC-09)
// ---------------------------------------------------------------------------

export const BatchMetricsSchema = z.object({
  duration_ms: z.number().int().min(0),
  total_tasks: z.number().int().min(0),
  successful: z.number().int().min(0),
  failed: z.number().int().min(0),
});

export const BatchOutputSchema = z.object({
  batch_id: z.string(),
  distribution_date: isoDate,
  task_results: z.array(TaskResultSchema),
  updated_queue_state: QueueStateSchema,
  alerts_summary: z.record(z.string(), z.number()),
  metrics: BatchMetricsSchema,
});

// ---------------------------------------------------------------------------
// Tipos inferidos dos schemas (garante alinhamento TS <-> Zod)
// ---------------------------------------------------------------------------

export type ExecutorZ = z.infer<typeof ExecutorSchema>;
export type CalendarDayZ = z.infer<typeof CalendarDaySchema>;
export type ProcessZ = z.infer<typeof ProcessSchema>;
export type TaskZ = z.infer<typeof TaskSchema>;
export type PreferenceHistoryZ = z.infer<typeof PreferenceHistorySchema>;
export type QueueStateZ = z.infer<typeof QueueStateSchema>;
export type BatchInputZ = z.infer<typeof BatchInputSchema>;
export type TaskResultZ = z.infer<typeof TaskResultSchema>;
export type BatchOutputZ = z.infer<typeof BatchOutputSchema>;
