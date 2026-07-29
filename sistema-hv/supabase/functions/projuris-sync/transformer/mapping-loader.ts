/**
 * Mapping Loader — Carrega mapeamentos e estado do Supabase
 *
 * Funcoes para carregar task_type_mapping, theme_mapping,
 * projuris_executor_mapping, QueueState e M90 do banco.
 *
 * Story 2.3 — Epic 2
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js';
import type { QueueState, Executor, CalendarDay } from '../config/types.ts';
import type { Mappings, TaskTypeMapping, ThemeMapping } from './projuris-to-motor.ts';

// ---------------------------------------------------------------------------
// loadMappings (AC-10)
// ---------------------------------------------------------------------------

export async function loadMappings(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Mappings> {
  // Queries em paralelo
  const [taskTypesRes, themesRes, executorsRes] = await Promise.all([
    supabase
      .from('system_task_type_mapping')
      .select('projuris_tipo_codigo, motor_task_type_id, points, complexity_level, temporal_level')
      .eq('organization_id', organizationId)
      .eq('active', true),
    supabase
      .from('system_theme_mapping')
      .select('projuris_tema_codigo, motor_theme_id, multiplier, temporal_level')
      .eq('organization_id', organizationId)
      .eq('active', true),
    supabase
      .from('system_projuris_executor_mapping')
      .select('projuris_responsavel_id, executor_id')
      .eq('organization_id', organizationId)
      .eq('active', true),
  ]);

  const taskTypes = new Map<string, TaskTypeMapping>();
  for (const row of taskTypesRes.data ?? []) {
    taskTypes.set(row.projuris_tipo_codigo, {
      motor_task_type_id: row.motor_task_type_id,
      points: row.points,
      complexity_level: row.complexity_level,
      temporal_level: row.temporal_level,
    });
  }

  const themes = new Map<string, ThemeMapping>();
  for (const row of themesRes.data ?? []) {
    themes.set(row.projuris_tema_codigo, {
      motor_theme_id: row.motor_theme_id,
      multiplier: row.multiplier,
      temporal_level: row.temporal_level,
    });
  }

  const executors = new Map<string, string>();
  for (const row of executorsRes.data ?? []) {
    executors.set(row.projuris_responsavel_id, row.executor_id);
  }

  return { taskTypes, themes, executors };
}

// ---------------------------------------------------------------------------
// loadQueueState (AC-11)
// ---------------------------------------------------------------------------

export async function loadQueueState(
  supabase: SupabaseClient,
  organizationId: string,
  batchDate: string,
): Promise<QueueState> {
  const { data } = await supabase.rpc('system_get_queue_state', {
    p_organization_id: organizationId,
    p_batch_date: batchDate,
  });

  if (data && data.length > 0) {
    const row = data[0];
    return {
      general_balances: row.general_balances ?? {},
      complex_balances: row.complex_balances ?? {},
      rotating_order: row.rotating_order ?? [],
    };
  }

  return { general_balances: {}, complex_balances: {}, rotating_order: [] };
}

// ---------------------------------------------------------------------------
// calculateM90 (AC-12)
// ---------------------------------------------------------------------------

export async function calculateM90(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const fromDate = ninetyDaysAgo.toISOString().split('T')[0];

  const { data } = await supabase
    .from('system_distribution_results')
    .select('distribution_date, final_points')
    .eq('organization_id', organizationId)
    .gte('distribution_date', fromDate)
    .eq('blocked', false);

  if (!data || data.length === 0) return 10; // Default M90 para primeiros batches (R-010)

  // Soma de pontos por dia
  const dailyTotals = new Map<string, number>();
  for (const row of data) {
    const current = dailyTotals.get(row.distribution_date) ?? 0;
    dailyTotals.set(row.distribution_date, current + row.final_points);
  }

  // FR-025: denominador = dias com producao > 0
  const daysWithProduction = [...dailyTotals.values()].filter(v => v > 0).length;
  if (daysWithProduction === 0) return 10;

  const totalPoints = [...dailyTotals.values()].reduce((sum, v) => sum + v, 0);
  return totalPoints / daysWithProduction;
}

// ---------------------------------------------------------------------------
// loadExecutors — Carrega executores ativos do sistema
// ---------------------------------------------------------------------------

export async function loadExecutors(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Executor[]> {
  const { data } = await supabase
    .from('system_users')
    .select('id, active')
    .eq('organization_id', organizationId);

  // Para MVP, todos executores ativos com peso default
  // A configuracao detalhada vem da Story 4.2
  return (data ?? [])
    .filter((u: { active: boolean }) => u.active !== false)
    .map((u: { id: string }) => ({
      executor_id: u.id,
      active: true,
      general_weight: 100,
      complex_eligible: true,
      authorized_task_types: [],
      authorized_themes: [],
    }));
}

// ---------------------------------------------------------------------------
// loadCalendar — Carrega calendario operacional
// ---------------------------------------------------------------------------

export async function loadCalendar(
  supabase: SupabaseClient,
  organizationId: string,
  fromDate: string,
  toDate: string,
): Promise<CalendarDay[]> {
  const { data: blocks } = await supabase
    .from('system_distribution_calendar')
    .select('date, block_type, executor_id')
    .eq('organization_id', organizationId)
    .gte('date', fromDate)
    .lte('date', toDate);

  // Gerar calendario completo do periodo
  const calendar: CalendarDay[] = [];
  const generalBlocks = new Set<string>();
  const individualBlocks = new Map<string, string[]>(); // date -> executor_ids

  for (const b of blocks ?? []) {
    if (b.block_type === 'general') {
      generalBlocks.add(b.date);
    } else if (b.executor_id) {
      const existing = individualBlocks.get(b.date) ?? [];
      existing.push(b.executor_id);
      individualBlocks.set(b.date, existing);
    }
  }

  const [y, m, d] = fromDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const [ey, em, ed] = toDate.split('-').map(Number);
  const end = new Date(ey, em - 1, ed);

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const dow = dt.getDay();
    const isWeekday = dow >= 1 && dow <= 5;

    calendar.push({
      date: iso,
      globally_operational: isWeekday && !generalBlocks.has(iso),
      initial_team_points: 0,
      blocked_executor_ids: individualBlocks.get(iso) ?? [],
    });
  }

  return calendar;
}
