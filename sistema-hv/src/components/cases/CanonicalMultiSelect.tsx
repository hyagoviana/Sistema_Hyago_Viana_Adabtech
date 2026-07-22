// R2-09 (2026-07-22) — Seleção MÚLTIPLA para filtros do tema (type='multiselect').
// O admin cadastra N opções; o usuário marca 1 ou mais. Valor gravado como ARRAY
// de strings em canonical_fields. Reusado na ficha do caso, no pop-up pós-Word e
// na célula editável da Lista. Tolera valor legado como string separada por vírgula.

import { ChevronsUpDown } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function CanonicalMultiSelect({
  options,
  value,
  disabled,
  onChange,
  className,
}: {
  options: string[];
  value: unknown;
  disabled?: boolean;
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const selected = toStringArray(value);
  const label =
    selected.length === 0
      ? "Selecione…"
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} selecionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          className={
            className ??
            "flex w-full items-center justify-between gap-2 py-2 px-3 bg-[var(--card)] border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none disabled:opacity-60"
          }
        >
          <span className="truncate text-left">{label}</span>
          <ChevronsUpDown size={13} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-56 space-y-0.5 overflow-auto">
          {options.length === 0 ? (
            <div className="px-1 text-xs text-muted-foreground">Sem opções cadastradas.</div>
          ) : (
            options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--muted)]"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      if (c) onChange([...selected, opt]);
                      else onChange(selected.filter((s) => s !== opt));
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
