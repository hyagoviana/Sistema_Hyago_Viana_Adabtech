/**
 * Transformer Projuris -> Motor v1.0
 *
 * Converte dados Projuris para formato BatchInput do Motor.
 * Acessa tabelas de mapeamento do Supabase.
 *
 * Story 2.3 — Epic 2
 */

import type {
  BatchInput, Batch, Task, Process, Executor,
  CalendarDay, PreferenceHistory, QueueState, OperationMode,
} from '../config/types.ts';
import type { ProjurisTask, ProjurisProcess } from '../adapters/projuris-adapter.ts';

// ---------------------------------------------------------------------------
// Tipos de mapeamento
// ---------------------------------------------------------------------------

export interface TaskTypeMapping {
  motor_task_type_id: string;
  points: number;
  complexity_level: number;
  temporal_level: number;
}

export interface ThemeMapping {
  motor_theme_id: string;
  multiplier: number;
  temporal_level: number;
}

export interface Mappings {
  taskTypes: Map<string, TaskTypeMapping>;
  themes: Map<string, ThemeMapping>;
  executors: Map<string, string>; // projuris_responsavel_id -> executor_id
}

export interface TransformResult {
  tasks: Task[];
  processes: Process[];
  discarded: Array<{ taskId: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Normalizacao de datas (CON-006)
// ---------------------------------------------------------------------------

function normalizeDate(dateStr: string | null): string {
  if (!dateStr) return '9999-12-31'; // fallback para datas ausentes

  // Se formato dd/MM/yyyy
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  // Se ja ISO yyyy-MM-dd ou datetime
  if (dateStr.includes('T')) return dateStr.split('T')[0];
  return dateStr;
}

// ---------------------------------------------------------------------------
// transformTasks (AC-01)
// ---------------------------------------------------------------------------

export function transformTasks(
  projurisTasks: ProjurisTask[],
  projurisProcesses: Map<string, ProjurisProcess>,
  mappings: Mappings,
): TransformResult {
  const tasks: Task[] = [];
  const processMap = new Map<string, Process>();
  const discarded: Array<{ taskId: string; reason: string }> = [];

  for (let i = 0; i < projurisTasks.length; i++) {
    const pt = projurisTasks[i];

    // AC-02: Lookup tipo de tarefa
    const taskTypeMap = mappings.taskTypes.get(pt.tipoTarefa.codigo);
    if (!taskTypeMap) {
      discarded.push({ taskId: pt.codigoProjuris, reason: `task_type nao mapeado: ${pt.tipoTarefa.codigo}` });
      continue;
    }

    // AC-03: Lookup tema via processo
    const pp = projurisProcesses.get(pt.codigoProcesso);
    if (!pp) {
      discarded.push({ taskId: pt.codigoProjuris, reason: `processo nao encontrado: ${pt.codigoProcesso}` });
      continue;
    }

    const themeMap = mappings.themes.get(pp.tema.codigo);
    if (!themeMap) {
      discarded.push({ taskId: pt.codigoProjuris, reason: `theme nao mapeado: ${pp.tema.codigo}` });
      continue;
    }

    // AC-06: Mapeamento de executores absolutos
    const directedId = pp.responsavelDirecionado ? (mappings.executors.get(pp.responsavelDirecionado) ?? null) : null;
    const themeExecId = pp.executorExclusivoTema ? (mappings.executors.get(pp.executorExclusivoTema) ?? null) : null;
    const typeExecId = pp.executorExclusivoTipo ? (mappings.executors.get(pp.executorExclusivoTipo) ?? null) : null;

    // Build Process (dedup por process_id)
    if (!processMap.has(pt.codigoProcesso)) {
      processMap.set(pt.codigoProcesso, {
        process_id: pt.codigoProcesso,
        theme_id: themeMap.motor_theme_id,
        collective: pp.coletivo, // AC-07
        complexity_level: pp.complexidade as 0 | 1 | 2,
        temporal_level: pp.temporalidade as 0 | 1 | 2,
        directed_executor_id: directedId,
      });
    }

    // AC-04, AC-05: Pontos e multiplicador com fallback para mapeamento
    const points = (pt.tipoTarefa.pontos && pt.tipoTarefa.pontos > 0)
      ? pt.tipoTarefa.pontos
      : taskTypeMap.points;

    const multiplier = (pp.tema.multiplicador && pp.tema.multiplicador > 0)
      ? pp.tema.multiplicador
      : themeMap.multiplier;

    // Build Task
    tasks.push({
      task_id: pt.codigoProjuris,
      process_id: pt.codigoProcesso,
      task_type_id: taskTypeMap.motor_task_type_id,
      theme_id: themeMap.motor_theme_id,
      task_type_points: points,
      theme_multiplier: multiplier,
      task_type_complexity_level: taskTypeMap.complexity_level as 0 | 1 | 2,
      task_type_temporal_level: taskTypeMap.temporal_level as 0 | 1 | 2,
      task_override_complexity_level: 0,
      task_override_temporal_level: 0,
      theme_complexity_level: 0,
      theme_temporal_level: themeMap.temporal_level as 0 | 1 | 2,
      theme_exclusive_executor_id: themeExecId,
      task_type_exclusive_executor_id: typeExecId,
      fatal_date: normalizeDate(pt.prazoFatal), // AC-08
      internal_limit_date: normalizeDate(pt.prazoInterno), // AC-08
      input_order: i + 1, // AC-09
    });
  }

  // AC-14: Log discarded
  if (discarded.length > 0) {
    console.log(JSON.stringify({
      event: 'transform_discarded',
      count: discarded.length,
      items: discarded,
    }));
  }

  return {
    tasks,
    processes: Array.from(processMap.values()),
    discarded,
  };
}

// ---------------------------------------------------------------------------
// buildBatchInput (AC-13)
// ---------------------------------------------------------------------------

export function buildBatchInput(
  batchId: string,
  distributionDate: string,
  mode: OperationMode,
  m90: number,
  tasks: Task[],
  processes: Process[],
  executors: Executor[],
  calendar: CalendarDay[],
  preferenceHistory: PreferenceHistory[],
  queueState: QueueState,
): BatchInput {
  return {
    batch: {
      batch_id: batchId,
      distribution_date: distributionDate,
      mode,
      general_average_90d: m90,
      timezone: 'America/Sao_Paulo',
    },
    executors,
    calendar,
    processes,
    tasks,
    preference_history: preferenceHistory,
    queue_state: queueState,
  };
}
