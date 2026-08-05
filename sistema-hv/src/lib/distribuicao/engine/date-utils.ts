/**
 * Utilidades de Data — Motor de Distribuicao v1.0 (PORTE Node).
 * Fonte: supabase/functions/projuris-sync/utils/date-utils.ts
 * Funcoes puras — sem dependencia externa. Dia operacional = seg-sex sem
 * bloqueio geral no calendario.
 */

import type { CalendarDay } from "./types";

export const TZ = "America/Sao_Paulo";

/** Parse ISO date string para Date */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Formata Date para ISO date string YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adiciona N dias a uma data */
export function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/** Dia da semana: 0=domingo, 6=sabado */
export function dayOfWeek(iso: string): number {
  return parseDate(iso).getDay();
}

/** Verifica se e dia de semana (seg-sex) */
export function isWeekday(iso: string): boolean {
  const dow = dayOfWeek(iso);
  return dow >= 1 && dow <= 5;
}

/** Set de datas com bloqueio geral para lookup O(1) */
export function buildGeneralBlockSet(calendar: CalendarDay[]): Set<string> {
  const blocks = new Set<string>();
  for (const day of calendar) {
    if (!day.globally_operational) {
      blocks.add(day.date);
    }
  }
  return blocks;
}

/** Verifica se uma data e operacional (dia de semana + sem bloqueio geral) */
export function isOperationalDay(iso: string, generalBlocks: Set<string>): boolean {
  return isWeekday(iso) && !generalBlocks.has(iso);
}

/** Retorna lista de datas operacionais entre `from` e `to` (inclusive ambos). */
export function getOperationalDays(from: string, to: string, calendar: CalendarDay[]): string[] {
  const generalBlocks = buildGeneralBlockSet(calendar);
  const result: string[] = [];
  let current = from;

  while (current <= to) {
    if (isOperationalDay(current, generalBlocks)) {
      result.push(current);
    }
    current = addDays(current, 1);
  }

  return result;
}

/** Conta dias operacionais entre `from` e `to` (exclusive ambos). */
export function countOperationalDaysBetween(
  from: string,
  to: string,
  generalBlocks: Set<string>,
): number {
  let count = 0;
  let current = addDays(from, 1); // exclusive from
  while (current < to) {
    // exclusive to
    if (isOperationalDay(current, generalBlocks)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

/** Adiciona N dias operacionais a partir de uma data (exclusive da data base). */
export function addOperationalDays(from: string, n: number, generalBlocks: Set<string>): string {
  if (n === 0) return from;

  let remaining = n;
  let current = from;

  while (remaining > 0) {
    current = addDays(current, 1);
    if (isOperationalDay(current, generalBlocks)) {
      remaining--;
    }
  }

  return current;
}

/** Distancia em dias operacionais entre B e L (exclusive de ambos). */
export function distanceOperationalDays(
  from: string,
  to: string,
  generalBlocks: Set<string>,
): number {
  return countOperationalDaysBetween(from, to, generalBlocks);
}

/** Nome do dia da semana para lookup de fatores de referencia diaria. */
export function weekdayName(iso: string): "monday" | "tuesday_to_thursday" | "friday" {
  const dow = dayOfWeek(iso);
  if (dow === 1) return "monday";
  if (dow === 5) return "friday";
  return "tuesday_to_thursday";
}
