import { Controller, useWatch, type Control } from "react-hook-form";

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

// C1 (2026-08-26) — as capacidades que só os campos do CASO tinham.

/**
 * Multi-ocorrência guarda ARRAY na MESMA chave — igual aos campos do caso
 * (`occurrencesToSlots`, em `lib/cases/tema-field-value.ts`).
 *
 * Achado QA-13: a primeira versão usava sufixo (`campo__2`), o que teria criado
 * DUAS convenções para a mesma ideia e quebrado o espelho cliente→tema (B1), que
 * casa exatamente pela key.
 */
function slotsDoValor(value: unknown, quantas: number): string[] {
  const n = Math.max(1, Math.min(quantas || 1, 20));
  const arr = Array.isArray(value)
    ? value.map((v) => (v == null ? "" : String(v)))
    : value == null || value === ""
      ? []
      : [String(value)];
  const out = arr.slice(0, n);
  while (out.length < n) out.push("");
  return out;
}

/** Rótulo de cada linha: numerado (auto) ou o texto que o admin escreveu. */
function subtituloDaLinha(def: ClientFieldDef, i: number): string | null {
  const mode = (def as { subtitle_mode?: string | null }).subtitle_mode ?? null;
  if (!mode) return null;
  if (mode === "auto") return `${def.label} ${i + 1}`;
  const subs = (def as { subtitles?: unknown }).subtitles;
  const lista = Array.isArray(subs) ? subs : [];
  const t = typeof lista[i] === "string" ? (lista[i] as string) : "";
  return t.trim() || `${def.label} ${i + 1}`;
}

/**
 * Ordena os campos deixando cada PAR VINCULADO junto (C1).
 *
 * "na hora que eu marco que esse aqui é vinculado no outro, lá na situação eles
 * aparecem juntinhos" — Thiago, 26/08. O vínculo é simétrico no banco, então
 * basta puxar o par para logo depois do primeiro dos dois que aparecer.
 */
function ordenarComVinculados(defs: ClientFieldDef[]): ClientFieldDef[] {
  const porId = new Map(defs.map((d) => [d.id, d]));
  const usados = new Set<string>();
  const saida: ClientFieldDef[] = [];

  for (const d of defs) {
    if (usados.has(d.id)) continue;
    saida.push(d);
    usados.add(d.id);

    const parId = (d as { linked_field_def_id?: string | null }).linked_field_def_id ?? null;
    const par = parId ? porId.get(parId) : undefined;
    if (par && !usados.has(par.id)) {
      saida.push(par);
      usados.add(par.id);
    }
  }
  return saida;
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
  // C1 — o campo DEPENDENTE precisa saber se o pai já tem valor. Observa o balde
  // inteiro (`custom_fields`) uma vez, em vez de um watch por campo.
  const valores = (useWatch({ control, name: "custom_fields" }) ?? {}) as Record<string, unknown>;
  const temValor = (v: unknown) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";

  if (!defs.length) return null;

  return (
    <div className="border-t pt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Informações adicionais
      </p>

      {ordenarComVinculados(defs).map((def) => {
        const name = `custom_fields.${def.key}`;
        // C1 — quantas caixinhas aparecem de largada (teto em max_occurrences).
        const maxOcc = (def as { max_occurrences?: number }).max_occurrences ?? 1;
        const iniOcc = Math.min(
          (def as { initial_occurrences?: number }).initial_occurrences ?? 1,
          maxOcc,
        );
        const paiId = (def as { parent_field_def_id?: string | null }).parent_field_def_id ?? null;
        const labelEl = (
          <label className="text-sm font-medium leading-none">
            {def.label}
            {def.required && <span className="text-destructive"> *</span>}
          </label>
        );

        return (
          <div
            key={def.id}
            className={`space-y-1.5 ${
              // C1 — DEPENDENTE: enquanto o pai não tem valor, o campo fica
              // apagado e sem clique (mesma regra dos campos do caso).
              paiId && !temValor(valores[defs.find((x) => x.id === paiId)?.key ?? ""])
                ? "opacity-50 pointer-events-none"
                : ""
            }`}
          >
            {def.field_type !== "boolean" && labelEl}

            {/* C1 — MÚLTIPLAS LINHAS (QA-13: array na MESMA chave, como no caso).
                Um Controller só; as N caixinhas editam posições do array. */}
            {maxOcc > 1 ? (
              <Controller
                control={control}
                name={name}
                render={({ field, fieldState }) => {
                  const preenchidos = Array.isArray(field.value)
                    ? field.value.filter((v: unknown) => v != null && v !== "").length
                    : 0;
                  const linhas = Math.min(Math.max(iniOcc, preenchidos), maxOcc);
                  const slots = slotsDoValor(field.value, linhas);
                  const tipoInput =
                    def.field_type === "number" || def.field_type === "money"
                      ? "number"
                      : def.field_type === "date"
                        ? "date"
                        : def.field_type === "link"
                          ? "url"
                          : "text";

                  const gravar = (novos: string[]) => {
                    const limpos = novos.map((v) => v.trim()).filter(Boolean);
                    field.onChange(limpos.length ? limpos : null);
                  };

                  return (
                    <div className="space-y-1.5">
                      {slots.map((slot, i) => (
                        <div key={i} className="space-y-0.5">
                          {subtituloDaLinha(def, i) && (
                            <p className="text-[10.5px] text-muted-foreground">
                              {subtituloDaLinha(def, i)}
                            </p>
                          )}
                          <Input
                            type={tipoInput}
                            step={def.field_type === "money" ? "0.01" : undefined}
                            placeholder={def.help_text ?? ""}
                            value={slot}
                            onChange={(e) => {
                              const novos = [...slots];
                              novos[i] = e.target.value;
                              gravar(novos);
                            }}
                          />
                        </div>
                      ))}
                      {slots.length < maxOcc && (
                        <button
                          type="button"
                          onClick={() => gravar([...slots, ""])}
                          className="text-[11px] text-[var(--gold-700)] hover:underline"
                        >
                          + adicionar linha
                        </button>
                      )}
                      {fieldState.error?.message && (
                        <p className="text-[0.8rem] font-medium text-destructive">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
            ) : (
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

                    // C1 — LINK: o pedido que originou a conversa ("queria colocar
                    // 2 links para cada cliente"). Vira âncora clicável quando tem
                    // valor, para não obrigar a copiar e colar.
                    case "link":
                      return (
                        <div className="space-y-1">
                          <Input
                            type="url"
                            inputMode="url"
                            placeholder={def.help_text ?? "https://…"}
                            {...field}
                            value={field.value ?? ""}
                          />
                          {typeof field.value === "string" && field.value.trim() !== "" && (
                            <a
                              href={field.value}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[var(--gold-700)] hover:underline break-all"
                            >
                              Abrir link →
                            </a>
                          )}
                          {errEl}
                        </div>
                      );

                    // C1 — VALOR (R$): número com passo de centavo. A formatação BR
                    // fica na exibição; aqui é entrada.
                    case "money":
                      return (
                        <div>
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder={def.help_text ?? "0,00"}
                            {...field}
                            value={field.value ?? ""}
                          />
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
            )}

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
