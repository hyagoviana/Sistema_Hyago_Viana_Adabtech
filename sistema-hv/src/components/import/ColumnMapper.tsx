import { ArrowRight, Info, Sparkles } from "lucide-react";
import { useEffect, useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ColumnMapping } from "@/lib/validators/import";
import {
  suggestMapping,
  TARGET_FIELDS,
  TRANSFORMS,
  type TargetFieldDef,
} from "@/lib/validators/import";

type Props = {
  headers: string[];
  sampleRows: Record<string, string>[];
  targetEntity: "client" | "case" | "client+case";
  mappings: ColumnMapping[];
  onChange: (mappings: ColumnMapping[]) => void;
  extraFields?: TargetFieldDef[];
};

export function ColumnMapper({
  headers,
  sampleRows,
  targetEntity,
  mappings,
  onChange,
  extraFields = [],
}: Props) {
  const availableFields = useMemo(() => {
    const base =
      targetEntity === "client+case"
        ? TARGET_FIELDS
        : TARGET_FIELDS.filter((f) => f.entity === targetEntity);
    return [...base, ...extraFields];
  }, [targetEntity, extraFields]);

  const fieldsByGroup = useMemo(() => {
    const groups = new Map<string, TargetFieldDef[]>();
    for (const f of availableFields) {
      const list = groups.get(f.group) ?? [];
      list.push(f);
      groups.set(f.group, list);
    }
    return groups;
  }, [availableFields]);

  useEffect(() => {
    if (mappings.length > 0) return;
    const suggested: ColumnMapping[] = [];
    for (const h of headers) {
      const target = suggestMapping(h);
      if (target && availableFields.some((f) => f.key === target)) {
        suggested.push({ sourceColumn: h, targetField: target });
      } else {
        suggested.push({ sourceColumn: h, targetField: "" });
      }
    }
    onChange(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  // Lookup rapido: key do campo -> fieldType
  const fieldTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of availableFields) {
      if (f.fieldType) m.set(f.key, f.fieldType);
    }
    return m;
  }, [availableFields]);

  const updateMapping = (index: number, field: keyof ColumnMapping, value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-seleciona transform "split_list" quando mapeia para campo multiselect
    if (field === "targetField" && value) {
      const ft = fieldTypeMap.get(value);
      if (ft === "multiselect") {
        updated[index] = { ...updated[index], transform: "split_list" };
      } else if (updated[index].transform === "split_list") {
        // Se trocou de multiselect para outro tipo, limpa
        updated[index] = { ...updated[index], transform: "none" };
      }
    }

    onChange(updated);
  };

  const samples = sampleRows.slice(0, 3);
  const mapped = mappings.filter((m) => m.targetField && m.targetField !== "").length;
  const suggested = mappings.filter(
    (m) => m.targetField && suggestMapping(m.sourceColumn) === m.targetField,
  ).length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        {/* Dica compacta inline */}
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
          <Info size={14} className="shrink-0 mt-0.5 text-[var(--gold-700)]" />
          <p>
            Para cada coluna do seu arquivo, escolha o{" "}
            <strong className="text-[var(--navy)]">campo no sistema</strong> correspondente. Use{" "}
            <strong className="text-[var(--navy)]">transformacao</strong> se o formato precisa ser
            convertido (ex.: datas, CPF).
            {suggested > 0 && (
              <span className="text-amber-600">
                {" "}
                Sugerimos {suggested} campos automaticamente (
                <Sparkles size={10} className="inline" />
                ).
              </span>
            )}
          </p>
        </div>

        {/* Cabecalho */}
        <div className="flex items-center gap-3 px-3 pb-1 border-b border-muted-foreground/10">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Coluna do arquivo
            </span>
          </div>
          <div className="w-[14px] shrink-0" />
          <div className="w-[220px] shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Campo no sistema
            </span>
          </div>
          <div className="w-[180px] shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Transformacao
            </span>
          </div>
        </div>

        {/* Linhas */}
        <div className="space-y-1.5">
          {headers.map((header, idx) => {
            const mapping = mappings[idx];
            const isMapped = mapping?.targetField && mapping.targetField !== "";
            const wasSuggested = isMapped && suggestMapping(header) === mapping?.targetField;
            const mappedFieldType = isMapped ? fieldTypeMap.get(mapping.targetField) : null;
            const isMultiselect = mappedFieldType === "multiselect";

            return (
              <div key={header} className="space-y-0">
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    isMapped
                      ? isMultiselect
                        ? "border-purple-200 bg-purple-50/30"
                        : "border-green-200 bg-green-50/30"
                      : "border-transparent bg-muted/20"
                  } ${isMultiselect ? "rounded-b-none" : ""}`}
                >
                  {/* Coluna origem */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-[var(--navy)] truncate">
                        {header}
                      </span>
                      {wasSuggested && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0 cursor-default">
                              <Sparkles size={11} className="text-amber-500" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            align="center"
                            className="text-xs max-w-[200px]"
                          >
                            Sugestao automatica baseada no nome da coluna
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                      {samples
                        .map((r) => r[header])
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(" · ") || "—"}
                    </div>
                  </div>

                  <ArrowRight size={14} className="text-muted-foreground/40 shrink-0" />

                  {/* Campo alvo */}
                  <div className="w-[220px] shrink-0">
                    <Select
                      value={mapping?.targetField || "__none__"}
                      onValueChange={(v) =>
                        updateMapping(idx, "targetField", v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Ignorar coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Ignorar coluna</span>
                        </SelectItem>
                        {Array.from(fieldsByGroup.entries()).map(([group, fields]) => (
                          <SelectGroup key={group}>
                            <SelectLabel className="text-xs">{group}</SelectLabel>
                            {fields.map((f) => {
                              const typeLabel =
                                f.fieldType === "multiselect"
                                  ? "multipla escolha"
                                  : f.fieldType === "select"
                                    ? "escolha"
                                    : f.fieldType === "boolean"
                                      ? "sim/nao"
                                      : f.fieldType === "date"
                                        ? "data"
                                        : f.fieldType === "money"
                                          ? "valor"
                                          : // C1 (2026-08-26) — o campo do cliente também
                                            // pode ser link agora; sem esta linha ele
                                            // aparecia sem indicação de tipo.
                                            f.fieldType === "link"
                                            ? "link"
                                            : null;
                              return (
                                <SelectItem key={f.key} value={f.key}>
                                  <span>{f.label}</span>
                                  {f.required && <span className="text-red-500 ml-1">*</span>}
                                  {typeLabel && (
                                    <span className="text-muted-foreground ml-1.5 text-[10px]">
                                      ({typeLabel})
                                    </span>
                                  )}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Transformacao */}
                  <div className="w-[180px] shrink-0">
                    <Select
                      value={mapping?.transform || "none"}
                      onValueChange={(v) => updateMapping(idx, "transform", v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSFORMS.map((t) => (
                          <SelectItem key={t.key} value={t.key} className="text-xs">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {isMultiselect && (
                  <div className="px-3 py-1.5 text-[11px] text-purple-700 bg-purple-50/50 border border-t-0 border-purple-200 rounded-b-lg">
                    Campo de multipla escolha — na planilha, separe os valores com{" "}
                    <strong>;</strong> (ex:{" "}
                    <code className="bg-purple-100 px-1 rounded">valor1; valor2; valor3</code>). A
                    transformacao ja foi aplicada automaticamente.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
