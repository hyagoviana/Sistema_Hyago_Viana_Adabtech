/**
 * Edge Function: projuris-sync — Entry point
 *
 * Orquestra o fluxo completo de distribuicao diaria:
 * adapter sync -> dedup -> transformer -> motor -> persistence -> write-back -> docs
 *
 * Story 3.1 (setup) + Story 3.2 (orchestrator) — Epic 3
 */

import { createClient } from 'npm:@supabase/supabase-js';
import { distributeBatch } from './engine/motor.ts';
import { MockProjurisAdapter } from './adapters/projuris-mock-adapter.ts';
import { ProjurisRestAdapter } from './adapters/projuris-rest-adapter.ts';
import type { ProjurisAdapter, ProjurisProcess } from './adapters/projuris-adapter.ts';
import { deduplicateTasks } from './dedup/dedup-service.ts';
import { transformTasks, buildBatchInput } from './transformer/projuris-to-motor.ts';
import { loadMappings, loadQueueState, calculateM90, loadExecutors, loadCalendar } from './transformer/mapping-loader.ts';
import { persistBatchResults, createBatchLog, updateBatchLogStatus } from './persistence/batch-repository.ts';
import { executeWriteBack, retryPendingWriteBacks } from './writeback/projuris-writeback.ts';
import type { OperationMode } from './config/types.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEOUT_THRESHOLD_MS = 350_000;
const ORG_ID = '00000000-0000-0000-0000-000000000001'; // MVP single-tenant

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

// ---------------------------------------------------------------------------
// Adapter selector
// ---------------------------------------------------------------------------

function getAdapter(): ProjurisAdapter {
  const adapterType = Deno.env.get('PROJURIS_ADAPTER') ?? 'mock';
  if (adapterType === 'rest') {
    return new ProjurisRestAdapter({
      PROJURIS_BASE_URL: Deno.env.get('PROJURIS_BASE_URL') ?? '',
      PROJURIS_AUTH_TYPE: Deno.env.get('PROJURIS_AUTH_TYPE') ?? 'oauth2_password',
      PROJURIS_USERNAME: Deno.env.get('PROJURIS_USERNAME') ?? '',
      PROJURIS_PASSWORD: Deno.env.get('PROJURIS_PASSWORD') ?? '',
      PROJURIS_TOKEN: Deno.env.get('PROJURIS_TOKEN') ?? '',
      PROJURIS_API_KEY: Deno.env.get('PROJURIS_API_KEY') ?? '',
      // OAuth2 password grant (auth REAL do ProJuris ADV — Keycloak)
      PROJURIS_AUTH_URL: Deno.env.get('PROJURIS_AUTH_URL') ?? '',
      PROJURIS_CLIENT_ID: Deno.env.get('PROJURIS_CLIENT_ID') ?? Deno.env.get('PROJURIS_API_CLIENTE_CODIGO') ?? '',
      PROJURIS_CLIENT_SECRET: Deno.env.get('PROJURIS_CLIENT_SECRET') ?? '',
      PROJURIS_DOMINIO: Deno.env.get('PROJURIS_DOMINIO') ?? '',
    });
  }
  return new MockProjurisAdapter();
}

// ---------------------------------------------------------------------------
// Today in BRT
// ---------------------------------------------------------------------------

function getTodayBRT(): string {
  const now = new Date();
  // Offset BRT: UTC-3 (ignorando horario de verao por simplicidade — CON-006)
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

function healthCheck(): Response {
  return Response.json({
    status: 'ok',
    version: '1.0',
    timestamp: new Date().toISOString(),
    adapter: Deno.env.get('PROJURIS_ADAPTER') ?? 'mock',
  });
}

// ---------------------------------------------------------------------------
// Main batch orchestrator (AC-01, AC-02)
// ---------------------------------------------------------------------------

async function runDistributionBatch(options: {
  simulate?: boolean;
  manual?: boolean;
  distributionDate?: string;
}): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  const adapter = getAdapter();
  const distributionDate = options.distributionDate ?? getTodayBRT();
  const mode: OperationMode = (Deno.env.get('DISTRIBUTION_MODE') as OperationMode) ?? 'HIGH_PRODUCTION';

  const log = (step: string, data: Record<string, unknown>) => {
    console.log(JSON.stringify({ event: 'batch_step', step, ...data, elapsed_ms: Date.now() - startTime }));
  };

  // Step 1: Criar batch_log
  let batchLogId: string | null = null;
  try {
    batchLogId = await createBatchLog(supabase, ORG_ID, distributionDate);
    log('batch_log_created', { batchLogId });
  } catch (error) {
    log('batch_log_failed', { error: String(error) });
  }

  try {
    // Step 2: Buscar tarefas pendentes
    log('fetch_tasks_start', {});
    const projurisTasks = await adapter.fetchPendingTasks(distributionDate);
    log('fetch_tasks_done', { count: projurisTasks.length });

    if (projurisTasks.length === 0) {
      if (batchLogId) await updateBatchLogStatus(supabase, batchLogId, 'completed', undefined, { reason: 'no_pending_tasks' });
      return { status: 'success', message: 'Nenhuma tarefa pendente', total_tasks: 0 };
    }

    // Step 3: Buscar processos para cada tarefa
    log('fetch_processes_start', {});
    const processMap = new Map<string, ProjurisProcess>();
    const uniqueProcessIds = [...new Set(projurisTasks.map(t => t.codigoProcesso))];
    await Promise.all(uniqueProcessIds.map(async (pid) => {
      try {
        const p = await adapter.fetchProcess(pid);
        processMap.set(pid, p);
      } catch (e) {
        log('fetch_process_error', { processId: pid, error: String(e) });
      }
    }));
    log('fetch_processes_done', { count: processMap.size });

    // Step 4: Deduplicar tarefas
    log('dedup_start', {});
    const dedupResult = await deduplicateTasks(supabase, projurisTasks, distributionDate, ORG_ID);
    log('dedup_done', { unique: dedupResult.uniqueTasks.length, duplicated: dedupResult.duplicatedTasks.length });

    if (dedupResult.uniqueTasks.length === 0) {
      if (batchLogId) await updateBatchLogStatus(supabase, batchLogId, 'completed', undefined, { reason: 'all_duplicated' });
      return { status: 'success', message: 'Todas tarefas ja distribuidas', total_tasks: 0, duplicated: dedupResult.duplicatedTasks.length };
    }

    // Step 5: Carregar mapeamentos, estado, M90, executores, calendario
    log('load_config_start', {});
    const [mappings, queueState, m90, executors, calendar] = await Promise.all([
      loadMappings(supabase, ORG_ID),
      loadQueueState(supabase, ORG_ID, distributionDate),
      calculateM90(supabase, ORG_ID),
      loadExecutors(supabase, ORG_ID),
      loadCalendar(supabase, ORG_ID, distributionDate, addDays(distributionDate, 60)),
    ]);
    log('load_config_done', { executors: executors.length, calendar_days: calendar.length, m90 });

    // Step 6: Transformar para BatchInput
    log('transform_start', {});
    const transformed = transformTasks(dedupResult.uniqueTasks, processMap, mappings);
    log('transform_done', { tasks: transformed.tasks.length, discarded: transformed.discarded.length });

    if (transformed.tasks.length === 0) {
      if (batchLogId) await updateBatchLogStatus(supabase, batchLogId, 'completed', undefined, { reason: 'all_discarded_by_transform' });
      return { status: 'success', message: 'Nenhuma tarefa apos transformacao', total_tasks: 0, discarded: transformed.discarded.length };
    }

    // Buscar historico de preferencia
    const preferenceHistory = await loadPreferenceHistory(adapter, uniqueProcessIds);

    const batchInput = buildBatchInput(
      crypto.randomUUID(), distributionDate, mode, m90,
      transformed.tasks, transformed.processes, executors,
      calendar, preferenceHistory, queueState,
    );

    // Check timeout
    if (Date.now() - startTime > TIMEOUT_THRESHOLD_MS) {
      if (batchLogId) await updateBatchLogStatus(supabase, batchLogId, 'failed', 'Timeout antes do Motor');
      return { status: 'timeout', message: 'Timeout antes de executar o Motor', elapsed_ms: Date.now() - startTime };
    }

    // Step 7: Executar Motor
    log('motor_start', {});
    const batchOutput = distributeBatch(batchInput);
    log('motor_done', { ...batchOutput.metrics });

    // Step 8: Persistir resultados
    if (!options.simulate) {
      log('persist_start', {});
      const rawDataMap = new Map<string, Record<string, unknown>>();
      for (const t of dedupResult.uniqueTasks) {
        rawDataMap.set(t.codigoProjuris, t as unknown as Record<string, unknown>);
      }
      await persistBatchResults(supabase, batchOutput, ORG_ID, rawDataMap);
      log('persist_done', {});
    } else {
      log('persist_skipped', { reason: 'simulation_mode' });
    }

    // Step 9: Write-back (nao-critico — AC-04)
    let writeBackSummary = { total: 0, success: 0, failed: 0, retry_queued: 0, alert_generated: false };
    if (!options.simulate) {
      try {
        log('writeback_start', {});
        const reverseMapping = new Map<string, string>();
        for (const [projId, execId] of mappings.executors) {
          reverseMapping.set(execId, projId);
        }
        writeBackSummary = await executeWriteBack(
          supabase, adapter, batchOutput.task_results, reverseMapping, ORG_ID,
        );
        log('writeback_done', { ...writeBackSummary });

        // Step 10: Retry pendentes de batches anteriores
        log('retry_pending_start', {});
        const retrySummary = await retryPendingWriteBacks(supabase, adapter, ORG_ID);
        log('retry_pending_done', { ...retrySummary });
      } catch (error) {
        log('writeback_error', { error: String(error) });
      }
    }

    // Step 11: Atualizar batch_log com sucesso
    if (batchLogId) {
      await updateBatchLogStatus(supabase, batchLogId, 'completed', undefined, {
        ...batchOutput.metrics,
        alerts_summary: batchOutput.alerts_summary,
        writeback: writeBackSummary,
      });
    }

    // Step 12: Retornar resposta (AC-06)
    const response = {
      status: 'success',
      batch_id: batchOutput.batch_id,
      distribution_date: distributionDate,
      total_tasks: batchOutput.metrics.total_tasks,
      successful: batchOutput.metrics.successful,
      failed: batchOutput.metrics.failed,
      alerts_summary: batchOutput.alerts_summary,
      write_back_summary: writeBackSummary,
      duration_ms: Date.now() - startTime,
      simulation: options.simulate ?? false,
      manual: options.manual ?? false,
    };

    log('batch_complete', response);
    return response;
  } catch (error) {
    // AC-03: Falha critica
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (batchLogId) {
      await updateBatchLogStatus(supabase, batchLogId, 'failed', errorMsg).catch(() => {});
    }
    console.error(JSON.stringify({ event: 'batch_error', error: errorMsg, elapsed_ms: Date.now() - startTime }));
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function loadPreferenceHistory(adapter: ProjurisAdapter, processIds: string[]) {
  const history: Array<{ process_id: string; task_type_id: string; executor_id: string; completion_date: string; relevant: boolean }> = [];
  for (const pid of processIds) {
    try {
      const h = await adapter.fetchHistory(pid);
      for (const entry of h) {
        if (entry.executor) {
          history.push({
            process_id: entry.codigoProcesso,
            task_type_id: entry.tipoTarefa,
            executor_id: entry.executor,
            completion_date: entry.data,
            relevant: true,
          });
        }
      }
    } catch { /* ignore history errors */ }
  }
  return history;
}

// ---------------------------------------------------------------------------
// HTTP Handler (AC-02, AC-07, AC-08, AC-09)
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Health check (GET)
  if (req.method === 'GET') return healthCheck();

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await runDistributionBatch({
      simulate: body.simulate === true,
      manual: body.manual === true || body.source !== 'pg_cron',
      distributionDate: body.distribution_date,
    });

    const status = result.status === 'success' ? 200 : result.status === 'timeout' ? 202 : 500;
    return Response.json(result, { status });
  } catch (error) {
    return Response.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});
