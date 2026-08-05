/**
 * buildBatchInput — PORTE Node (subset puro) do transformer do motor.
 * Fonte: supabase/functions/projuris-sync/transformer/projuris-to-motor.ts
 *
 * So expomos `buildBatchInput` (montagem final do BatchInput). A conversao
 * ProJuris -> Task[]/Process[] fica no orquestrador (src/rpc/distribuicao.ts),
 * que ja le mappings/executores/calendario direto do Supabase. Zero dependencia
 * do adapter Deno.
 */

import type {
  BatchInput,
  Task,
  Process,
  Executor,
  CalendarDay,
  PreferenceHistory,
  QueueState,
  OperationMode,
} from "./types";

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
      timezone: "America/Sao_Paulo",
    },
    executors,
    calendar,
    processes,
    tasks,
    preference_history: preferenceHistory,
    queue_state: queueState,
  };
}
