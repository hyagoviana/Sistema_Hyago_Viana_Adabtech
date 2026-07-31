/**
 * Simulation Repository — Persistencia de resultados de simulacao
 *
 * Salva em distribution_simulations (separado de producao).
 *
 * Story 6.1 — Epic 6
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js';
import type { BatchOutput } from '../config/types.ts';

const INSERT_CHUNK_SIZE = 100;

export async function persistSimulationResults(
  supabase: SupabaseClient,
  batchOutput: BatchOutput,
  simulationRunId: string,
  simulationMode: string,
  organizationId: string,
): Promise<void> {
  const rows = batchOutput.task_results.map((r) => ({
    organization_id: organizationId,
    simulation_run_id: simulationRunId,
    simulation_mode: simulationMode,
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
    blocked: r.blocked,
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from('system_distribution_simulations').insert(chunk);
    if (error) throw error;
  }

  // Batch log com is_simulation=true
  await supabase.from('system_distribution_batch_logs').insert({
    organization_id: organizationId,
    batch_date: batchOutput.distribution_date,
    started_at: new Date(Date.now() - batchOutput.metrics.duration_ms).toISOString(),
    completed_at: new Date().toISOString(),
    status: 'completed',
    total_tasks: batchOutput.metrics.total_tasks,
    successful: batchOutput.metrics.successful,
    failed: batchOutput.metrics.failed,
    alerts_generated: Object.values(batchOutput.alerts_summary).reduce((s, v) => s + v, 0),
    is_simulation: true,
    metrics: {
      simulation_run_id: simulationRunId,
      duration_ms: batchOutput.metrics.duration_ms,
      alerts_summary: batchOutput.alerts_summary,
    },
  });

  console.log(JSON.stringify({
    event: 'persist_simulation',
    simulation_run_id: simulationRunId,
    results: rows.length,
  }));
}

export async function clearOldSimulations(
  supabase: SupabaseClient,
  organizationId: string,
  olderThanDays = 30,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const { data, error } = await supabase
    .from('system_distribution_simulations')
    .delete()
    .eq('organization_id', organizationId)
    .lt('simulated_at', cutoff.toISOString())
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}
