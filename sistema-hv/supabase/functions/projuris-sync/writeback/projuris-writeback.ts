/**
 * Projuris Write-Back — Atualiza responsavel de volta no Projuris
 *
 * Executado APOS persistencia local no Supabase (FR-008B).
 * Falhas logadas e retentadas no proximo ciclo.
 *
 * Story 2.5 — Epic 2
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js';
import type { ProjurisAdapter, WriteBackItem } from '../adapters/projuris-adapter.ts';
import type { TaskResult } from '../config/types.ts';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface WriteBackSummary {
  total: number;
  success: number;
  failed: number;
  retry_queued: number;
  alert_generated: boolean;
}

// ---------------------------------------------------------------------------
// executeWriteBack (AC-01)
// ---------------------------------------------------------------------------

export async function executeWriteBack(
  supabase: SupabaseClient,
  adapter: ProjurisAdapter,
  results: TaskResult[],
  executorToProjectis: Map<string, string>, // executor_id -> projuris_responsavel_id
  organizationId: string,
  rawTaskMap?: Map<string, { responsavelAtual: string | null }>,
): Promise<WriteBackSummary> {
  const summary: WriteBackSummary = { total: 0, success: 0, failed: 0, retry_queued: 0, alert_generated: false };

  // Filtrar tarefas nao-bloqueadas com executor atribuido
  const validResults = results.filter(r => !r.blocked && r.executor_id);
  summary.total = validResults.length;

  if (validResults.length === 0) return summary;

  // Separar em add (sem responsavel anterior) e replace (com responsavel diferente)
  const toAdd: WriteBackItem[] = [];
  const toReplace: WriteBackItem[] = [];

  for (const r of validResults) {
    const projurisResp = executorToProjectis.get(r.executor_id);
    if (!projurisResp) {
      // Executor nao mapeado
      await logWriteBackFailure(supabase, r, '', 'Executor nao mapeado em projuris_executor_mapping', organizationId);
      summary.failed++;
      summary.retry_queued++;
      continue;
    }

    const rawTask = rawTaskMap?.get(r.task_id);
    const previousResp = rawTask?.responsavelAtual;

    if (previousResp && previousResp !== projurisResp) {
      toReplace.push({
        codigoTarefa: r.task_id,
        codigoResponsavel: projurisResp,
        codigoResponsavelAnterior: previousResp,
      });
    } else {
      toAdd.push({
        codigoTarefa: r.task_id,
        codigoResponsavel: projurisResp,
      });
    }
  }

  // Executar write-backs em paralelo
  const [addResult, replaceResult] = await Promise.allSettled([
    toAdd.length > 0 ? adapter.addResponsibleBatch(toAdd) : Promise.resolve({ success: true, processedCount: 0, errors: [] }),
    toReplace.length > 0 ? adapter.replaceResponsibleBatch(toReplace) : Promise.resolve({ success: true, processedCount: 0, errors: [] }),
  ]);

  // Processar resultados add
  if (addResult.status === 'fulfilled') {
    summary.success += addResult.value.processedCount;
    for (const err of addResult.value.errors) {
      await logWriteBackFailure(supabase,
        validResults.find(r => r.task_id === err.codigoTarefa)!,
        executorToProjectis.get(validResults.find(r => r.task_id === err.codigoTarefa)?.executor_id ?? '') ?? '',
        err.error, organizationId);
      summary.failed++;
      summary.retry_queued++;
    }
  } else {
    // Falha total no batch add
    for (const item of toAdd) {
      const r = validResults.find(vr => vr.task_id === item.codigoTarefa);
      if (r) {
        await logWriteBackFailure(supabase, r, item.codigoResponsavel, String(addResult.reason), organizationId);
        summary.failed++;
        summary.retry_queued++;
      }
    }
  }

  // Processar resultados replace
  if (replaceResult.status === 'fulfilled') {
    summary.success += replaceResult.value.processedCount;
    for (const err of replaceResult.value.errors) {
      await logWriteBackFailure(supabase,
        validResults.find(r => r.task_id === err.codigoTarefa)!,
        executorToProjectis.get(validResults.find(r => r.task_id === err.codigoTarefa)?.executor_id ?? '') ?? '',
        err.error, organizationId);
      summary.failed++;
      summary.retry_queued++;
    }
  } else {
    for (const item of toReplace) {
      const r = validResults.find(vr => vr.task_id === item.codigoTarefa);
      if (r) {
        await logWriteBackFailure(supabase, r, item.codigoResponsavel, String(replaceResult.reason), organizationId);
        summary.failed++;
        summary.retry_queued++;
      }
    }
  }

  // AC-06: ALT-SYNC-001 se houve falhas
  if (summary.failed > 0) {
    summary.alert_generated = true;
    console.log(JSON.stringify({
      event: 'ALT-SYNC-001',
      severity: 'warning',
      message: `Write-back de ${summary.failed} tarefa(s) falhou. Retry agendado.`,
    }));
  }

  return summary;
}

// ---------------------------------------------------------------------------
// retryPendingWriteBacks (AC-07)
// ---------------------------------------------------------------------------

export async function retryPendingWriteBacks(
  supabase: SupabaseClient,
  adapter: ProjurisAdapter,
  organizationId: string,
): Promise<WriteBackSummary> {
  const summary: WriteBackSummary = { total: 0, success: 0, failed: 0, retry_queued: 0, alert_generated: false };

  // Buscar pendentes
  const { data: pending } = await supabase
    .from('system_distribution_writeback_log')
    .select('id, task_id, executor_id, projuris_responsavel_id, attempt')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);

  if (!pending || pending.length === 0) return summary;

  summary.total = pending.length;

  const items: WriteBackItem[] = pending.map(p => ({
    codigoTarefa: p.task_id,
    codigoResponsavel: p.projuris_responsavel_id,
  }));

  try {
    const result = await adapter.addResponsibleBatch(items);

    // Atualizar status dos sucedidos
    const errorTaskIds = new Set(result.errors.map(e => e.codigoTarefa));

    for (const p of pending) {
      if (!errorTaskIds.has(p.task_id)) {
        // AC-08: Sucesso
        await supabase.from('system_distribution_writeback_log')
          .update({ status: 'success' }).eq('id', p.id);
        await supabase.from('system_distribution_results')
          .update({ writeback_pending: false }).eq('task_id', p.task_id);
        summary.success++;
      } else {
        // AC-09: Falha — incrementar attempt
        const err = result.errors.find(e => e.codigoTarefa === p.task_id);
        await supabase.from('system_distribution_writeback_log')
          .update({ attempt: p.attempt + 1, error: err?.error ?? 'Unknown' }).eq('id', p.id);
        summary.failed++;
        summary.retry_queued++;
      }
    }
  } catch (error) {
    // Falha total
    for (const p of pending) {
      await supabase.from('system_distribution_writeback_log')
        .update({ attempt: p.attempt + 1, error: String(error) }).eq('id', p.id);
    }
    summary.failed = pending.length;
    summary.retry_queued = pending.length;
  }

  if (summary.failed > 0) summary.alert_generated = true;
  return summary;
}

// ---------------------------------------------------------------------------
// Helper — log de falha
// ---------------------------------------------------------------------------

async function logWriteBackFailure(
  supabase: SupabaseClient,
  result: TaskResult,
  projurisRespId: string,
  error: string,
  organizationId: string,
): Promise<void> {
  // Buscar distribution_result_id
  const { data } = await supabase
    .from('system_distribution_results')
    .select('id')
    .eq('task_id', result.task_id)
    .eq('distribution_date', result.distribution_date)
    .eq('organization_id', organizationId)
    .single();

  if (data) {
    await supabase.from('system_distribution_writeback_log').insert({
      organization_id: organizationId,
      distribution_result_id: data.id,
      task_id: result.task_id,
      executor_id: result.executor_id,
      projuris_responsavel_id: projurisRespId,
      error,
      attempt: 1,
      status: 'pending',
    });

    await supabase.from('system_distribution_results')
      .update({ writeback_pending: true })
      .eq('id', data.id);
  }
}
