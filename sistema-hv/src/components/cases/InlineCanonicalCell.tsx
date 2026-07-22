// R2-09 (reunião 2026-07-22) — Célula EDITÁVEL inline para a Lista de casos.
// Edita um filtro/campo do tema (system_tema_field_defs) direto na linha, sem
// abrir a ficha. Grava em system_cases.canonical_fields (mecanismo S2-07). Como
// a LINHA inteira é clicável (navega para o caso), todo evento aqui usa
// stopPropagation para não navegar ao interagir com a célula.

import { useState } from "react";
import { toast } from "sonner";

import { CanonicalMultiSelect, toStringArray } from "@/components/cases/CanonicalMultiSelect";
import { useUpdateCaseCanonicalFields } from "@/hooks/useCases";
import type { TemaFieldDef } from "@/hooks/useTemaFieldDefs";
import { centavosFromMask, centavosToMask, maskCentavos } from "@/lib/format";

const cellSelect =
  "w-full min-w-[110px] py-1 px-1.5 bg-transparent border border-[var(--border)] rounded text-[12px] focus:border-[var(--gold)] outline-none";
const cellInput = cellSelect;

function optionsToArray(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

export function InlineCanonicalCell({
  caseId,
  def,
  value,
  canEdit,
}: {
  caseId: string;
  def: TemaFieldDef;
  value: unknown;
  canEdit: boolean;
}) {
  const updateMut = useUpdateCaseCanonicalFields();
  const [money, setMoney] = useState(() => centavosToMask(value));

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  async function save(v: string | number | boolean | string[] | null) {
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [def.key]: v } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  const strValue = value === null || value === undefined ? "" : String(value);

  if (!canEdit) {
    // Só leitura: mostra o valor formatado.
    if (def.type === "boolean")
      return (
        <span>
          {value === true || value === "true"
            ? "Sim"
            : value === false || value === "false"
              ? "Não"
              : "—"}
        </span>
      );
    if (def.type === "multiselect") {
      const arr = toStringArray(value);
      return <span>{arr.length ? arr.join(", ") : "—"}</span>;
    }
    if (def.type === "money") return <span>{centavosToMask(value) || "—"}</span>;
    return <span>{strValue || "—"}</span>;
  }

  if (def.type === "multiselect") {
    return (
      <CanonicalMultiSelect
        options={optionsToArray(def.options)}
        value={value}
        onChange={(arr) => save(arr)}
        className={cellSelect + " flex items-center justify-between gap-1"}
      />
    );
  }

  if (def.type === "boolean") {
    const boolStr =
      value === true || value === "true"
        ? "true"
        : value === false || value === "false"
          ? "false"
          : "";
    return (
      <select
        value={boolStr}
        onClick={stop}
        onChange={(e) => {
          stop(e);
          save(e.target.value === "" ? null : e.target.value === "true");
        }}
        className={cellSelect}
      >
        <option value="">—</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }

  if (def.type === "select") {
    return (
      <select
        value={strValue}
        onClick={stop}
        onChange={(e) => {
          stop(e);
          save(e.target.value || null);
        }}
        className={cellSelect}
      >
        <option value="">—</option>
        {optionsToArray(def.options).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (def.type === "money") {
    return (
      <input
        value={money}
        inputMode="numeric"
        placeholder="0,00"
        onClick={stop}
        onChange={(e) => {
          stop(e);
          setMoney(maskCentavos(e.target.value));
        }}
        onBlur={(e) => {
          stop(e);
          save(centavosFromMask(money));
        }}
        className={cellInput}
      />
    );
  }

  const inputType = def.type === "number" ? "number" : def.type === "date" ? "date" : "text";
  return (
    <input
      type={inputType}
      defaultValue={strValue}
      key={strValue}
      onClick={stop}
      onBlur={(e) => {
        stop(e);
        const raw = e.target.value.trim();
        if (def.type === "number") save(raw === "" ? null : Number(raw));
        else save(raw || null);
      }}
      className={cellInput}
    />
  );
}
