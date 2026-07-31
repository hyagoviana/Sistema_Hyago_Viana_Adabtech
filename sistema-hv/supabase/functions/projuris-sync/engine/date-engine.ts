/**
 * Date Engine — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Calculo de datas: base date (D+N), limite aplicavel, data preferencial,
 * data final (busca por ocupacao).
 *
 * Pure functions — sem efeitos colaterais.
 *
 * Referencia: regras_motor_distribuicao_v1.0.yaml, secoes `date_engine`, `daily_reference`
 *
 * Story 1.4 — Epic 1
 */

import type {
  CalendarDay,
  OperationMode,
  TaskResult,
  TemporalLevel,
} from '../config/types.ts';
import type { ScoredTask } from './scoring.ts';
import {
  addOperationalDays,
  buildGeneralBlockSet,
  distanceOperationalDays,
  isOperationalDay,
  addDays,
  weekdayName,
} from '../utils/date-utils.ts';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DateEngineInput {
  distributionDate: string;
  task: ScoredTask;
  fatalDate: string;
  internalLimitDate: string;
  isAbsolute: boolean;
}

export interface DateEngineResult {
  base_date: string;
  applicable_limit: string;
  preferred_date: string | null;
  final_date: string;
  alerts: string[];
}

// ---------------------------------------------------------------------------
// Constantes de referencia diaria (spec YAML, secao `daily_reference`)
// ---------------------------------------------------------------------------

const DAILY_FACTORS: Record<OperationMode, Record<string, number>> = {
  HIGH_PRODUCTION: { monday: 0.95, tuesday_to_thursday: 1.00, friday: 0.90 },
  HIGH_CONTROL: { monday: 0.90, tuesday_to_thursday: 1.00, friday: 0.80 },
};

// ---------------------------------------------------------------------------
// Base Date — D+N (AC-01, AC-02)
// ---------------------------------------------------------------------------

/**
 * Calcula a data base (D+N) conforme temporalidade e regra de D+0.
 *
 * - D+0: somente se fatal_date == distribution_date
 * - D+1: urgente (temporal == 2)
 * - D+2: prioritario (temporal == 1) OU absoluto nao-prioritario
 * - D+3: normal (temporal == 0, nao-absoluto)
 */
export function calculateBaseDate(
  distributionDate: string,
  fatalDate: string,
  finalTemporal: TemporalLevel,
  isAbsolute: boolean,
  generalBlocks: Set<string>,
): { baseDate: string; alerts: string[] } {
  const alerts: string[] = [];

  // D+0: somente se fatal no proprio dia
  if (fatalDate === distributionDate) {
    alerts.push('ALT-DATA-001'); // critical: fatal D+0
    return { baseDate: distributionDate, alerts };
  }

  // Fatal antes de D+0 — blocking
  if (fatalDate < distributionDate) {
    alerts.push('ALT-PRAZO-002'); // blocking: fatal antes de D+0
    return { baseDate: distributionDate, alerts };
  }

  // Determinar N para D+N
  let dPlus: number;

  if (finalTemporal === 2) {
    // Urgente -> D+1
    dPlus = 1;
  } else if (finalTemporal === 1 || isAbsolute) {
    // Prioritario ou absoluto nao-prioritario -> D+2
    dPlus = 2;
  } else {
    // Normal -> D+3
    dPlus = 3;
  }

  const baseDate = addOperationalDays(distributionDate, dPlus, generalBlocks);
  return { baseDate, alerts };
}

// ---------------------------------------------------------------------------
// Applicable Limit (AC-03)
// ---------------------------------------------------------------------------

/**
 * Calcula o limite aplicavel conforme temporalidade.
 *
 * - Urgente: min(internal_limit, fatal, D+7)
 * - Prioritario: min(priority_ceiling, internal_limit, fatal)
 *     ceiling: original<=D+10 -> D+6, <=D+15 -> D+10, >D+15 -> D+13
 * - Normal: min(internal_limit, fatal)
 */
export function calculateApplicableLimit(
  distributionDate: string,
  internalLimitDate: string,
  fatalDate: string,
  finalTemporal: TemporalLevel,
  generalBlocks: Set<string>,
): { applicableLimit: string; alerts: string[] } {
  const alerts: string[] = [];

  if (finalTemporal === 2) {
    // Urgente: teto D+7
    const d7 = addOperationalDays(distributionDate, 7, generalBlocks);
    const applicableLimit = minDate(internalLimitDate, fatalDate, d7);
    return { applicableLimit, alerts };
  }

  if (finalTemporal === 1) {
    // Prioritario: calcular ceiling
    const distToOriginal = countOperationalDaysFromDistribution(
      distributionDate, internalLimitDate, generalBlocks
    );

    let ceilingDPlus: number;
    if (distToOriginal <= 10) {
      ceilingDPlus = 6;
    } else if (distToOriginal <= 15) {
      ceilingDPlus = 10;
    } else {
      ceilingDPlus = 13;
    }

    const ceiling = addOperationalDays(distributionDate, ceilingDPlus, generalBlocks);
    const applicableLimit = minDate(ceiling, internalLimitDate, fatalDate);
    return { applicableLimit, alerts };
  }

  // Normal: sem teto adicional
  const applicableLimit = minDate(internalLimitDate, fatalDate);

  // Verificar incompatibilidade de limite interno
  if (internalLimitDate < distributionDate) {
    alerts.push('ALT-PRAZO-001'); // warning: limite interno incompativel
  }

  return { applicableLimit, alerts };
}

// ---------------------------------------------------------------------------
// Preferred Date (AC-04)
// ---------------------------------------------------------------------------

/**
 * Calcula data preferencial para tarefas nao-urgentes.
 *
 * High Production: B + floor(dist_op_days(B,L) / 3)
 * High Control:    B + ceil(dist_op_days(B,L) / 2)
 *
 * Para urgentes retorna null.
 */
export function calculatePreferredDate(
  baseDate: string,
  applicableLimit: string,
  finalTemporal: TemporalLevel,
  mode: OperationMode,
  generalBlocks: Set<string>,
): string | null {
  // Urgentes nao tem data preferencial
  if (finalTemporal === 2) return null;

  const distance = distanceOperationalDays(baseDate, applicableLimit, generalBlocks);

  let offset: number;
  if (mode === 'HIGH_PRODUCTION') {
    offset = Math.floor(distance / 3);
  } else {
    offset = Math.ceil(distance / 2);
  }

  return addOperationalDays(baseDate, offset, generalBlocks);
}

// ---------------------------------------------------------------------------
// Day Load / Occupancy (AC-06)
// ---------------------------------------------------------------------------

/**
 * Calcula a carga (soma de pontos) de um executor em uma data especifica.
 */
export function calculateDayLoad(
  date: string,
  executorId: string,
  existingResults: TaskResult[],
): number {
  let load = 0;
  for (const r of existingResults) {
    if (r.executor_id === executorId && r.final_date === date && !r.blocked) {
      load += r.final_points;
    }
  }
  return load;
}

/**
 * Calcula a referencia diaria do executor: M90 * fator_dia_semana_modo.
 */
export function calculateDailyReference(
  m90: number,
  date: string,
  mode: OperationMode,
): number {
  const dayName = weekdayName(date);
  const factor = DAILY_FACTORS[mode][dayName] ?? 1.0;
  return m90 * factor;
}

/**
 * Calcula occupancy: day_load / daily_reference.
 */
export function calculateOccupancy(dayLoad: number, dailyReference: number): number {
  if (dailyReference <= 0) return Infinity;
  return dayLoad / dailyReference;
}

// ---------------------------------------------------------------------------
// Find Assignment Date (AC-05)
// ---------------------------------------------------------------------------

/**
 * Busca a data final de atribuicao com base na ocupacao.
 *
 * Nao-urgente:
 *   1. Tenta preferredDate se occupancy <= 1
 *   2. Busca a distancias iguais do preferencial (HP: anterior primeiro, HC: posterior primeiro)
 *   3. Se nenhuma com occupancy <= 1, escolhe menor occupancy
 *
 * Urgente:
 *   1. Cronologico de baseDate a applicableLimit
 *   2. Primeiro com occupancy <= 1
 *   3. Se nenhum, menor occupancy (empate: mais cedo)
 */
export function findAssignmentDate(
  baseDate: string,
  applicableLimit: string,
  preferredDate: string | null,
  finalTemporal: TemporalLevel,
  executorId: string,
  calendar: CalendarDay[],
  existingResults: TaskResult[],
  m90: number,
  mode: OperationMode,
  blockedExecutorDates: Set<string>,
): string {
  const generalBlocks = buildGeneralBlockSet(calendar);

  // Coletar dias operacionais elegiveis (executor nao bloqueado)
  const eligibleDays: string[] = [];
  let current = baseDate;
  while (current <= applicableLimit) {
    if (isOperationalDay(current, generalBlocks) && !blockedExecutorDates.has(current)) {
      eligibleDays.push(current);
    }
    current = addDays(current, 1);
  }

  if (eligibleDays.length === 0) {
    // Nenhuma data elegivel — retorna baseDate (sera tratado como alerta ALT-RESP-001/002)
    return baseDate;
  }

  if (finalTemporal === 2) {
    // Urgente: cronologico
    return findUrgentDate(eligibleDays, executorId, existingResults, m90, mode);
  }

  // Nao-urgente: busca ao redor do preferredDate
  return findNonUrgentDate(
    eligibleDays, preferredDate ?? baseDate, executorId, existingResults, m90, mode
  );
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function findUrgentDate(
  eligibleDays: string[],
  executorId: string,
  existingResults: TaskResult[],
  m90: number,
  mode: OperationMode,
): string {
  let bestDate = eligibleDays[0];
  let bestOccupancy = Infinity;

  for (const day of eligibleDays) {
    const load = calculateDayLoad(day, executorId, existingResults);
    const ref = calculateDailyReference(m90, day, mode);
    const occ = calculateOccupancy(load, ref);

    if (occ <= 1) return day; // Primeiro com capacidade

    if (occ < bestOccupancy) {
      bestOccupancy = occ;
      bestDate = day;
    }
  }

  return bestDate; // Menor occupancy (empate: mais cedo por ordem cronologica)
}

function findNonUrgentDate(
  eligibleDays: string[],
  preferredDate: string,
  executorId: string,
  existingResults: TaskResult[],
  m90: number,
  mode: OperationMode,
): string {
  // Calcular occupancy para cada dia elegivel
  const dayOccupancies: Array<{ date: string; occupancy: number; distFromPreferred: number }> = [];

  for (const day of eligibleDays) {
    const load = calculateDayLoad(day, executorId, existingResults);
    const ref = calculateDailyReference(m90, day, mode);
    const occ = calculateOccupancy(load, ref);
    const dist = Math.abs(eligibleDays.indexOf(day) - findClosestIndex(eligibleDays, preferredDate));
    dayOccupancies.push({ date: day, occupancy: occ, distFromPreferred: dist });
  }

  // 1. Tentar preferredDate direto
  const preferred = dayOccupancies.find(d => d.date === preferredDate);
  if (preferred && preferred.occupancy <= 1) return preferredDate;

  // 2. Buscar dias com occupancy <= 1, a distancias iguais do preferencial
  const available = dayOccupancies.filter(d => d.occupancy <= 1);

  if (available.length > 0) {
    // Ordenar por distancia do preferencial, com desempate por modo
    available.sort((a, b) => {
      if (a.distFromPreferred !== b.distFromPreferred) {
        return a.distFromPreferred - b.distFromPreferred;
      }
      // Desempate: HP = earlier (menor data), HC = later (maior data)
      if (mode === 'HIGH_PRODUCTION') {
        return a.date < b.date ? -1 : 1;
      }
      return a.date > b.date ? -1 : 1;
    });

    return available[0].date;
  }

  // 3. Nenhum com occupancy <= 1: menor occupancy
  dayOccupancies.sort((a, b) => {
    if (a.occupancy !== b.occupancy) return a.occupancy - b.occupancy;
    // Desempate: mais proximo do preferencial
    if (a.distFromPreferred !== b.distFromPreferred) return a.distFromPreferred - b.distFromPreferred;
    // Desempate final: HP earlier, HC later
    if (mode === 'HIGH_PRODUCTION') return a.date < b.date ? -1 : 1;
    return a.date > b.date ? -1 : 1;
  });

  return dayOccupancies[0].date;
}

function findClosestIndex(days: string[], target: string): number {
  let closest = 0;
  let minDiff = Infinity;
  for (let i = 0; i < days.length; i++) {
    const diff = Math.abs(parseSimpleDate(days[i]) - parseSimpleDate(target));
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  return closest;
}

function parseSimpleDate(iso: string): number {
  return parseInt(iso.replace(/-/g, ''), 10);
}

function minDate(...dates: string[]): string {
  return dates.reduce((min, d) => (d < min ? d : min));
}

/**
 * Conta dias operacionais de distribution_date ate targetDate (inclusive target).
 * Para calcular em qual faixa D+N o internal_limit cai.
 */
function countOperationalDaysFromDistribution(
  distributionDate: string,
  targetDate: string,
  generalBlocks: Set<string>,
): number {
  let count = 0;
  let current = addDays(distributionDate, 1);
  while (current <= targetDate) {
    if (isOperationalDay(current, generalBlocks)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Build blocked executor dates set (helper para chamadores)
// ---------------------------------------------------------------------------

/**
 * Constroi set de datas em que um executor especifico esta bloqueado individualmente.
 */
export function buildExecutorBlockedDates(
  executorId: string,
  calendar: CalendarDay[],
): Set<string> {
  const blocked = new Set<string>();
  for (const day of calendar) {
    if (day.blocked_executor_ids.includes(executorId)) {
      blocked.add(day.date);
    }
  }
  return blocked;
}

// ---------------------------------------------------------------------------
// Funcao orquestradora — processDateEngine
// ---------------------------------------------------------------------------

/**
 * Orquestra todo o calculo de datas para uma tarefa.
 * Retorna base_date, applicable_limit, preferred_date, final_date e alertas.
 */
export function processDateEngine(
  input: DateEngineInput,
  calendar: CalendarDay[],
  existingResults: TaskResult[],
  m90: number,
  mode: OperationMode,
  executorId: string,
): DateEngineResult {
  const generalBlocks = buildGeneralBlockSet(calendar);
  const allAlerts: string[] = [];

  // 1. Base Date
  const { baseDate, alerts: baseAlerts } = calculateBaseDate(
    input.distributionDate,
    input.fatalDate,
    input.task.final_temporal,
    input.isAbsolute,
    generalBlocks,
  );
  allAlerts.push(...baseAlerts);

  // Se fatal antes de D+0 (blocking), retornar imediatamente
  if (allAlerts.includes('ALT-PRAZO-002')) {
    return {
      base_date: baseDate,
      applicable_limit: input.fatalDate,
      preferred_date: null,
      final_date: baseDate,
      alerts: allAlerts,
    };
  }

  // 2. Applicable Limit
  const { applicableLimit, alerts: limitAlerts } = calculateApplicableLimit(
    input.distributionDate,
    input.internalLimitDate,
    input.fatalDate,
    input.task.final_temporal,
    generalBlocks,
  );
  allAlerts.push(...limitAlerts);

  // 3. Preferred Date
  const preferredDate = calculatePreferredDate(
    baseDate,
    applicableLimit,
    input.task.final_temporal,
    mode,
    generalBlocks,
  );

  // 4. Final Date (busca por ocupacao)
  const blockedDates = buildExecutorBlockedDates(executorId, calendar);
  const finalDate = findAssignmentDate(
    baseDate,
    applicableLimit,
    preferredDate,
    input.task.final_temporal,
    executorId,
    calendar,
    existingResults,
    m90,
    mode,
    blockedDates,
  );

  // Alertas de data final
  if (finalDate === input.distributionDate && input.fatalDate === input.distributionDate) {
    // D+0 com fatal — ja tem ALT-DATA-001
  } else if (finalDate <= addOperationalDays(input.distributionDate, 1, generalBlocks)) {
    if (!allAlerts.includes('ALT-DATA-001')) {
      allAlerts.push('ALT-DATA-002'); // exceptional: D+1
    }
  } else if (finalDate <= addOperationalDays(input.distributionDate, 2, generalBlocks)) {
    if (!allAlerts.includes('ALT-DATA-001') && !allAlerts.includes('ALT-DATA-002')) {
      allAlerts.push('ALT-DATA-003'); // exceptional: D+2
    }
  }

  return {
    base_date: baseDate,
    applicable_limit: applicableLimit,
    preferred_date: preferredDate,
    final_date: finalDate,
    alerts: allAlerts,
  };
}
