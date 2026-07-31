/**
 * Batch Repository — Persistencia de resultados do Motor no Supabase
 *
 * Insere distribution_results, queue_state e batch_logs.
 * Chunks de 100 para performance. Dedup via ON CONFLICT.
 *
 * Story 2.4 — Epic 2
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js';
import type { BatchOutput, TaskResult, QueueState } from '../config/types.ts';

const INSERT_CHUNK_SIZE = 100;

// ---------------------------------------------------------------------------
// Tipo intermediario com raw_data
// ---------------------------------------------------------------------------

export interface TaskResultWithRaw extends TaskResult {
  _raw_data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// persistBatchResults (AC-01)
// ---------------------------------------------------------------------------

export async function persistBatchResults(
  supabase: SupabaseClient,
  batchOutput: BatchOutput,
  organizationId: string,
  rawDataMap?: Map<string, Record<string, unknown>>,
): Promise<void> {
  const startMs = Date.now();

  // 1. Inserir distribution_results em chunks (AC-10)
  const rows = batchOutput.task_results.map((r) => ({
    organization_id: organizationId,
    task_id: r.task_id,
    process_id: r.process_id,
    distribution_date: r.distribution_date,
    final_points: r.final_points,
    flow: r.flow,
    base_date: r.base_date,
    applicable_limit: r.applicable_limit,
    preferred_date: r.preferred_date,
    final_date: r.final_date,
    executor_id: r.executor_id || null,
    preference_applied: r.preference_applied,
    alerts: r.alerts,
    writeback_pending: false,
    raw_data: rawDataMap?.get(r.task_id) ?? null, // AC-03
  }));

  let insertedCount = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    // AC-07: ON CONFLICT ignore duplicates
    const { error, count } = await supabase
      .from('system_distribution_results')
      .upsert(chunk, { onConflict: 'task_id,distribution_date,organization_id', ignoreDuplicates: true });

    if (error) throw error;
    insertedCount += count ?? chunk.length;
  }

  // 2. Inserir queue_state (AC-04)
  const { error: qsError } = await supabase
    .from('system_distribution_queue_state')
    .insert({
      organization_id: organizationId,
      batch_date: batchOutput.distribution_date,
      general_balances: batchOutput.updated_queue_state.general_balances,
      complex_balances: batchOutput.updated_queue_state.complex_balances,
      rotating_order: batchOutput.updated_queue_state.rotating_order,
    });
  if (qsError) throw qsError;

  // 3. Inserir batch_log (AC-05)
  const { error: blError } = await supabase
    .from('system_distribution_batch_logs')
    .insert({
      organization_id: organizationId,
      batch_date: batchOutput.distribution_date,
      started_at: new Date(Date.now() - batchOutput.metrics.duration_ms).toISOString(),
      completed_at: new Date().toISOString(),
      status: 'completed',
      total_tasks: batchOutput.metrics.total_tasks,
      successful: batchOutput.metrics.successful,
      failed: batchOutput.metrics.failed,
      alerts_generated: Object.values(batchOutput.alerts_summary).reduce((s, v) => s + v, 0),
      metrics: {
        duration_ms: batchOutput.metrics.duration_ms,
        alerts_summary: batchOutput.alerts_summary,
      },
    });
  if (blError) throw blError;

  const durationMs = Date.now() - startMs;
  console.log(JSON.stringify({
    event: 'persist_batch_results',
    results_inserted: insertedCount,
    queue_state_saved: true,
    batch_log_saved: true,
    duration_ms: durationMs,
  }));
}

// ---------------------------------------------------------------------------
// createBatchLog — Cria registro inicial (status=running)
// ---------------------------------------------------------------------------

export async function createBatchLog(
  supabase: SupabaseClient,
  organizationId: string,
  batchDate: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('system_distribution_batch_logs')
    .insert({
      organization_id: organizationId,
      batch_date: batchDate,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ---------------------------------------------------------------------------
// updateBatchLogStatus (AC-08)
// ---------------------------------------------------------------------------

export async function updateBatchLogStatus(
  supabase: SupabaseClient,
  batchLogId: string,
  status: 'completed' | 'failed',
  errorMessage?: string,
  metrics?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('system_distribution_batch_logs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
      metrics: metrics ?? null,
    })
    .eq('id', batchLogId);

  if (error) throw error;
}
