import { Controller, type Control } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/lib/supabase/types";

export type ClientFieldDef = Database["public"]["Tables"]["system_client_field_defs"]["Row"];

function optionsOf(def: ClientFieldDef): string[] {
  if (!Array.isArray(def.options)) return [];
  return def.options.filter((o): o is string => typeof o === "string");
}

// Renderiza os campos customizados (Melhoria 1) abaixo dos campos fixos.
// Os valores vivem em `custom_fields.<key>` no formulário.
export function CustomFieldsSection({
  defs,
  control,
}: {
  defs: ClientFieldDef[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
}) {
  if (!defs.length) return null;

  return (
    <div className="border-t pt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Informações adicionais
      </p>

      {defs.map((def) => {
        const name = `custom_fields.${def.key}`;
        const labelEl = (
          <label className="text-sm font-medium leading-none">
            {def.label}
            {def.required && <span className="text-destructive"> *</span>}
          </label>
        );

        return (
          <div key={def.id} className="space-y-1.5">
            {def.field_type !== "boolean" && labelEl}

            <Controller
              control={control}
              name={name}
              render={({ field, fieldState }) => {
                const err = fieldState.error?.message;
                const errEl = err ? (
                  <p className="text-[0.8rem] font-medium text-destructive">{err}</p>
                ) : null;

                switch (def.field_type) {
                  case "textarea":
                    return (
                      <div>
                        <Textarea
                          placeholder={def.help_text ?? ""}
                          {...field}
                          value={field.value ?? ""}
                        />
                        {errEl}
                      </div>
                    );

                  case "number":
                    return (
                      <div>
                        <Input
                          type="number"
                          placeholder={def.help_text ?? ""}
                          {...field}
                          value={field.value ?? ""}
                        />
                        {errEl}
                      </div>
                    );

                  case "date":
                    return (
                      <div>
                        <Input type="date" {...field} value={field.value ?? ""} />
                        {errEl}
                      </div>
                    );

                  case "select":
                    return (
                      <div>
                        <Combobox
                          options={optionsOf(def)}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Selecione…"
                          searchPlaceholder="Buscar…"
                        />
                        {errEl}
                      </div>
                    );

                  case "multiselect": {
                    const selected: string[] = Array.isArray(field.value) ? field.value : [];
                    return (
                      <div className="space-y-2">
                        {optionsOf(def).map((opt) => {
                          const checked = selected.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  if (c) field.onChange([...selected, opt]);
                                  else field.onChange(selected.filter((s) => s !== opt));
                                }}
                              />
                              {opt}
                            </label>
                          );
                        })}
                        {errEl}
                      </div>
                    );
                  }

                  case "boolean":
                    return (
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm font-medium">
                          {def.label}
                          {def.help_text && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {def.help_text}
                            </span>
                          )}
                        </span>
                        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                      </div>
                    );

                  default:
                    return (
                      <div>
                        <Input
                          placeholder={def.help_text ?? ""}
                          {...field}
                          value={field.value ?? ""}
                        />
                        {errEl}
                      </div>
                    );
                }
              }}
            />

            {def.field_type !== "boolean" && def.help_text && def.field_type !== "number" && (
              <p className="text-[11px] text-muted-foreground">{def.help_text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Coleta as keys obrigatórias ainda sem valor (validação no submit, já que o
// zodResolver não cobre campos dinâmicos).
export function missingRequiredCustom(
  defs: ClientFieldDef[],
  values: Record<string, unknown> | null | undefined,
): string[] {
  const v = values ?? {};
  return defs
    .filter((d) => d.required)
    .filter((d) => {
      const val = v[d.key];
      if (d.field_type === "multiselect") return !Array.isArray(val) || val.length === 0;
      if (d.field_type === "boolean") return false; // boolean sempre tem valor (true/false)
      return val === undefined || val === null || String(val).trim() === "";
    })
    .map((d) => d.key);
}
