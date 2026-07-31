// Reunião 2026-07-29 — Helpers PUROS (client-safe) dos campos de TEMA.
// Centralizam a leitura do valor pela FONTE certa (scope) e a formatação p/
// exibição, para Lista, filtros, ficha e pop-up não duplicarem a regra.
//
//   • scope='caso'    → valor em system_cases.canonical_fields (por caso);
//   • scope='cliente' → valor em system_clients.custom_fields (do cliente,
//                        compartilhado entre todos os casos dele).
//
// Múltiplas ocorrências (#6): campos texto/número/data com max_occurrences>1
// guardam um ARRAY de valores no mesmo balde.

import { centavosToMask } from "@/lib/format";

export type TemaFieldScope = "caso" | "cliente";

// Só o que os helpers precisam de uma def (evita acoplar ao tipo completo).
export type FieldLike = {
  key: string;
  type: string;
  scope?: TemaFieldScope | string | null;
  options?: unknown;
  max_occurrences?: number | null;
};

export type FieldValueSource = {
  canonical_fields?: Record<string, unknown> | null;
  client_custom_fields?: Record<string, unknown> | null;
};

// Fonte de valores do campo conforme o scope.
export function fieldBag(def: FieldLike, src: FieldValueSource): Record<string, unknown> {
  const bag = def.scope === "cliente" ? src.client_custom_fields : src.canonical_fields;
  return bag ?? {};
}

// Valor bruto do campo, lido da fonte certa.
export function readFieldValue(def: FieldLike, src: FieldValueSource): unknown {
  return fieldBag(def, src)[def.key];
}

export function isMultiOccurrence(def: FieldLike): boolean {
  const n = def.max_occurrences ?? 1;
  return n > 1 && (def.type === "text" || def.type === "number" || def.type === "date");
}

// Normaliza um valor de múltiplas ocorrências em N caixinhas (para render). Preenche
// com "" até `slots`; nunca menos de 1.
export function occurrencesToSlots(value: unknown, max: number): string[] {
  const slots = Math.max(1, Math.min(max || 1, 20));
  const arr = Array.isArray(value)
    ? value.map((v) => (v == null ? "" : String(v)))
    : value == null || value === ""
      ? []
      : [String(value)];
  const out = arr.slice(0, slots);
  while (out.length < slots) out.push("");
  return out;
}

function multiselectToArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim())
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

// Rótulo legível de um valor para EXIBIÇÃO (Lista/filtros/read-only).
export function formatTemaFieldValue(def: FieldLike, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (isMultiOccurrence(def)) {
    const arr = Array.isArray(value) ? value : [value];
    const clean = arr.map((v) => String(v).trim()).filter(Boolean);
    return clean.length ? clean.join(", ") : "—";
  }
  if (def.type === "boolean") {
    return value === true || value === "true"
      ? "Sim"
      : value === false || value === "false"
        ? "Não"
        : "—";
  }
  if (def.type === "multiselect") {
    const arr = multiselectToArray(value);
    return arr.length ? arr.join(", ") : "—";
  }
  if (def.type === "money") return centavosToMask(value) || "—";
  return String(value);
}
