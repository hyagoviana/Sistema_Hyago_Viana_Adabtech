/**
 * Servico de Deduplicacao — Motor de Distribuicao v1.0
 *
 * Garante que tarefas, andamentos e peticoes ja processados
 * nao sejam reprocessados em batches subsequentes.
 *
 * Story 2.6 — Epic 2
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js';
import type { ProjurisTask, ProjurisHistory } from '../adapters/projuris-adapter.ts';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DeduplicationResult {
  uniqueTasks: ProjurisTask[];
  duplicatedTasks: ProjurisTask[];
  duplicatedTasksLog: Array<{ taskId: string; reason: string; previousDate?: string }>;
  andamentosToUpdate: ProjurisHistory[];
}

// ---------------------------------------------------------------------------
// deduplicateTasks (AC-01)
// ---------------------------------------------------------------------------

export async function deduplicateTasks(
  supabase: SupabaseClient,
  projurisTasks: ProjurisTask[],
  _distributionDate: string,
  organizationId: string,
): Promise<DeduplicationResult> {
  const uniqueTasks: ProjurisTask[] = [];
  const duplicatedTasks: ProjurisTask[] = [];
  const duplicatedTasksLog: Array<{ taskId: string; reason: string; previousDate?: string }> = [];

  if (projurisTasks.length === 0) {
    return { uniqueTasks, duplicatedTasks, duplicatedTasksLog, andamentosToUpdate: [] };
  }

  // AC-08: Busca em batch — todos os task_ids de uma vez
  const allTaskIds = projurisTasks.map(t => t.codigoProjuris);

  const { data: existingResults } = await supabase
    .from('system_distribution_results')
    .select('task_id, distribution_date')
    .in('task_id', allTaskIds)
    .eq('organization_id', organizationId);

  // AC-02: Set de tarefas ja distribuidas
  const knownTasks = new Map<string, string>();
  for (const row of existingResults ?? []) {
    knownTasks.set(row.task_id, row.distribution_date);
  }

  // AC-03: Classificar
  for (const task of projurisTasks) {
    const previousDate = knownTasks.get(task.codigoProjuris);
    if (previousDate) {
      duplicatedTasks.push(task);
      duplicatedTasksLog.push({
        taskId: task.codigoProjuris,
        reason: 'already_distributed',
        previousDate,
      });
    } else {
      uniqueTasks.push(task);
    }
  }

  // AC-10: Log de auditoria
  if (duplicatedTasksLog.length > 0) {
    console.log(JSON.stringify({
      event: 'dedup_tasks',
      total: projurisTasks.length,
      unique: uniqueTasks.length,
      duplicated: duplicatedTasks.length,
      details: duplicatedTasksLog,
      timestamp: new Date().toISOString(),
    }));
  }

  return { uniqueTasks, duplicatedTasks, duplicatedTasksLog, andamentosToUpdate: [] };
}

// ---------------------------------------------------------------------------
// deduplicateAndamentos (AC-05)
// ---------------------------------------------------------------------------

export async function deduplicateAndamentos(
  supabase: SupabaseClient,
  andamentos: ProjurisHistory[],
  organizationId: string,
): Promise<{ newAndamentos: ProjurisHistory[]; updatedAndamentos: ProjurisHistory[] }> {
  if (andamentos.length === 0) return { newAndamentos: [], updatedAndamentos: [] };

  const ids = andamentos.map(a => a.codigoAndamento);

  const { data: existing } = await supabase
    .from('system_distribution_results') // Placeholder — tabela projuris_andamentos se existir
    .select('task_id')
    .in('task_id', ids)
    .eq('organization_id', organizationId)
    .limit(1);

  // Simplificado: se tabela projuris_andamentos nao existe ainda, retornar todos como novos
  if (!existing) return { newAndamentos: andamentos, updatedAndamentos: [] };

  const knownIds = new Set((existing ?? []).map((r: { task_id: string }) => r.task_id));
  const newAndamentos = andamentos.filter(a => !knownIds.has(a.codigoAndamento));
  const updatedAndamentos: ProjurisHistory[] = []; // Hash comparison seria feito aqui

  return { newAndamentos, updatedAndamentos };
}

// ---------------------------------------------------------------------------
// computeContentHash (AC-11)
// ---------------------------------------------------------------------------

export async function computeContentHash(content: Record<string, unknown>): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(content));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
