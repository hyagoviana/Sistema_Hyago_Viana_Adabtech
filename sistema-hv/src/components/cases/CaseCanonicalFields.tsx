import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CanonicalMultiSelect } from "@/components/cases/CanonicalMultiSelect";
import { useUpdateCaseCanonicalFields } from "@/hooks/useCases";
import { useUpdateClientCustomFields } from "@/hooks/useClients";
import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";
import { FIES_FIELD_KEYS } from "@/lib/cases/fies-fields";
import { VINCULO_FIELD_KEYS } from "@/lib/cases/vinculo-fields";
import { isMultiOccurrence, occurrencesToSlots } from "@/lib/cases/tema-field-value";
import { centavosFromMask, centavosToMask, maskCentavos } from "@/lib/format";

// Bloco "Dados do serviço" — campos canônicos do CASO (ex.: nº FIES).
// Distinto dos custom fields de CLIENTE. O VALOR grava sempre em
// system_cases.canonical_fields (S2-07) via updateCaseCanonicalFields (INALTERADO).
//
// R2-07: quando o caso tem `temaId`, renderiza os campos DEFINIDOS para o
// tema+frente (label/type/ordem/required), MAIS as chaves livres remanescentes
// que não têm def (para não esconder/perder valores já gravados). Sem tema,
// comportamento legado: pares chave/valor livres.

function optionsToArray(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

export function CaseCanonicalFields({
  caseId,
  canonicalFields,
  canEdit,
  temaId,
  frenteSlug,
  clientId,
  clientCustomFields,
}: {
  caseId: string;
  canonicalFields: Record<string, unknown> | null | undefined;
  canEdit: boolean;
  temaId?: string | null;
  frenteSlug?: string | null;
  // 2026-07-29 #3 — cliente do caso + seus custom_fields, para campos scope='cliente'.
  clientId?: string | null;
  clientCustomFields?: Record<string, unknown> | null;
}) {
  const updateMut = useUpdateCaseCanonicalFields();
  const updateClientMut = useUpdateClientCustomFields();
  // R2-07 — defs do tema+frente (só quando o caso tem tema).
  const { data: defsData } = useTemaFieldDefs(temaId ?? null, frenteSlug ?? null);
  const defs = (defsData as TemaFieldDef[] | undefined) ?? [];

  // Campos FIES (R5-06) e de VÍNCULO (R1-05) têm UI estruturada própria
  // (FiesFields / VinculoFields) e gravam no mesmo canonical_fields; filtra-os
  // aqui para não duplicar a edição.
  const structuredKeys = new Set<string>([
    ...(FIES_FIELD_KEYS as readonly string[]),
    ...(VINCULO_FIELD_KEYS as readonly string[]),
  ]);
  const defKeys = new Set(defs.map((d) => d.key));

  const cf = canonicalFields ?? {};
  // Chaves LIVRES remanescentes = tudo que não é estruturado (FIES/vínculo) e não
  // tem def. Mantidas visíveis/editáveis no modo chave/valor para NUNCA perder
  // valores já gravados.
  const freeEntries = Object.entries(cf).filter(([k]) => !structuredKeys.has(k) && !defKeys.has(k));

  const clientCf = clientCustomFields ?? {};

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  async function saveKey(key: string, value: string | number | boolean | string[] | null) {
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: value } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  // 2026-07-29 #3 — grava na FONTE certa: campo do caso → canonical_fields;
  // campo do cliente → custom_fields do cliente (compartilhado entre os casos).
  async function saveDef(def: TemaFieldDef, value: string | number | boolean | string[] | null) {
    try {
      if (def.scope === "cliente") {
        if (!clientId) {
          toast.error("Caso sem cliente vinculado — não dá para salvar campo do cliente.");
          return;
        }
        await updateClientMut.mutateAsync({ id: clientId, patch: { [def.key]: value } });
      } else {
        await updateMut.mutateAsync({ id: caseId, patch: { [def.key]: value } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  async function addField() {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key) {
      toast.error("Informe o nome do campo");
      return;
    }
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: value || null } });
      setNewKey("");
      setNewValue("");
      toast.success("Campo salvo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar campo");
    }
  }

  async function removeField(key: string) {
    if (!confirm(`Remover o campo "${key}" do serviço?`)) return;
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: null } });
      toast.success("Campo removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  return (
    <div className="card-hero p-7">
      <Eyebrow>Dados do serviço</Eyebrow>
      <p className="text-[12px] text-muted-foreground mt-1">
        Campos do caso (ex.: nº do contrato). Distintos dos dados do cliente. Buscáveis.
      </p>

      {/* R2-07 — campos DEFINIDOS para o tema+frente. #3: valor lido da fonte
          certa (caso × cliente). */}
      {defs.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {defs.map((def) => (
            <TemaFieldInput
              // key inclui o caso: os campos com estado local semeado no mount
              // (MultiOccurrenceField/MoneyField) re-montam ao trocar de caso na
              // mesma rota, evitando valor "preso" do caso anterior (QA BUG-1).
              key={`${caseId}-${def.id}`}
              def={def}
              value={(def.scope === "cliente" ? clientCf : cf)[def.key]}
              canEdit={canEdit}
              disabled={updateMut.isPending || updateClientMut.isPending}
              onSave={(v) => saveDef(def, v)}
            />
          ))}
        </div>
      )}

      {/* Chaves LIVRES remanescentes (compat com valores já gravados). */}
      <div className="mt-4 space-y-2">
        {defs.length === 0 && freeEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campo preenchido.</p>
        ) : freeEntries.length > 0 ? (
          <>
            {defs.length > 0 && (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Outros campos
              </p>
            )}
            <ul className="space-y-1.5">
              {freeEntries.map(([key, value]) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 font-medium text-[var(--navy)]">{key}</span>
                  {canEdit ? (
                    <Input
                      defaultValue={String(value ?? "")}
                      onBlur={(e) => saveKey(key, e.target.value.trim() || null)}
                      className="flex-1"
                    />
                  ) : (
                    <span className="flex-1">{String(value ?? "—")}</span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      title="Remover campo"
                      onClick={() => removeField(key)}
                      disabled={updateMut.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {canEdit && (
        <div className="mt-4 flex items-end gap-2 border-t pt-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome do campo</label>
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Ex.: nº FIES"
              className="max-w-[180px]"
            />
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium">Valor</label>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Ex.: 123456789"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addField();
                }
              }}
            />
          </div>
          <Button type="button" onClick={addField} disabled={updateMut.isPending}>
            <Plus size={14} className="mr-1" /> Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}

// Renderiza um campo DEFINIDO conforme o tipo, gravando em canonical_fields.
// Exportado (R2-09) para reuso no pop-up de filtros pós-Word (CaseFilterFillDialog).
export function TemaFieldInput({
  def,
  value,
  canEdit,
  disabled,
  onSave,
}: {
  def: TemaFieldDef;
  value: unknown;
  canEdit: boolean;
  disabled: boolean;
  onSave: (value: string | number | boolean | string[] | null) => void;
}) {
  const strValue = value === null || value === undefined ? "" : String(value);

  const labelEl = (
    <Label className="flex items-center gap-1">
      {def.label}
      {def.required && <span className="text-destructive">*</span>}
    </Label>
  );

  // 2026-07-29 #6 — múltiplas ocorrências (texto/número/data): N caixinhas do
  // mesmo campo; grava um ARRAY (ex.: vários períodos de atuação).
  if (isMultiOccurrence(def)) {
    return (
      <MultiOccurrenceField
        def={def}
        value={value}
        labelEl={labelEl}
        canEdit={canEdit}
        disabled={disabled}
        onSave={onSave}
      />
    );
  }

  // R2-09 — múltipla escolha: usuário marca 1+ opções; grava array.
  if (def.type === "multiselect") {
    return (
      <div className="space-y-1">
        {labelEl}
        <CanonicalMultiSelect
          options={optionsToArray(def.options)}
          value={value}
          disabled={!canEdit || disabled}
          onChange={(arr) => onSave(arr)}
        />
      </div>
    );
  }

  // R2-09 — Sim/Não (tri-estado: Sim / Não / não definido). Grava boolean real
  // em canonical_fields (o RPC aceita string|number|boolean|null).
  if (def.type === "boolean") {
    const boolStr =
      value === true || value === "true"
        ? "true"
        : value === false || value === "false"
          ? "false"
          : "";
    return (
      <div className="space-y-1">
        {labelEl}
        <select
          value={boolStr}
          disabled={!canEdit || disabled}
          onChange={(e) => onSave(e.target.value === "" ? null : e.target.value === "true")}
          className="w-full py-2 px-3 bg-[var(--card)] border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none disabled:opacity-60"
        >
          <option value="">— não definido —</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div className="space-y-1">
        {labelEl}
        <Select
          value={strValue || undefined}
          disabled={!canEdit || disabled}
          onValueChange={(v) => onSave(v || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione…" />
          </SelectTrigger>
          <SelectContent>
            {optionsToArray(def.options).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (def.type === "money") {
    return (
      <MoneyField
        strValue={strValue}
        labelEl={labelEl}
        canEdit={canEdit}
        disabled={disabled}
        onSave={onSave}
      />
    );
  }

  const inputType = def.type === "number" ? "number" : def.type === "date" ? "date" : "text";
  return (
    <div className="space-y-1">
      {labelEl}
      <Input
        type={inputType}
        defaultValue={strValue}
        disabled={!canEdit || disabled}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (def.type === "number") {
            onSave(raw === "" ? null : Number(raw));
          } else {
            onSave(raw || null);
          }
        }}
      />
    </div>
  );
}

// Campo monetário (R$) — guarda em CENTAVOS (inteiro), como o resto do financeiro.
function MoneyField({
  strValue,
  labelEl,
  canEdit,
  disabled,
  onSave,
}: {
  strValue: string;
  labelEl: React.ReactNode;
  canEdit: boolean;
  disabled: boolean;
  onSave: (value: string | number | null) => void;
}) {
  // Centavos-primeiro: digita só números → formata "34.445,00". Guarda centavos.
  const [mask, setMask] = useState(() => centavosToMask(strValue));
  return (
    <div className="space-y-1">
      {labelEl}
      <Input
        value={mask}
        disabled={!canEdit || disabled}
        inputMode="numeric"
        placeholder="0,00"
        onChange={(e) => setMask(maskCentavos(e.target.value))}
        onBlur={() => onSave(centavosFromMask(mask))}
      />
    </div>
  );
}

// #6 — campo com N caixinhas do mesmo tipo (texto/número/data). Estado local dos
// slots; grava um ARRAY (descarta caixinhas vazias). Se sobrar 1 valor só, ainda
// grava como array de 1 — o formatador de exibição normaliza.
function MultiOccurrenceField({
  def,
  value,
  labelEl,
  canEdit,
  disabled,
  onSave,
}: {
  def: TemaFieldDef;
  value: unknown;
  labelEl: React.ReactNode;
  canEdit: boolean;
  disabled: boolean;
  onSave: (value: string[] | null) => void;
}) {
  const max = def.max_occurrences ?? 1;
  const [slots, setSlots] = useState<string[]>(() => occurrencesToSlots(value, max));
  const inputType = def.type === "number" ? "number" : def.type === "date" ? "date" : "text";

  function commit(next: string[]) {
    const clean = next.map((s) => s.trim()).filter(Boolean);
    onSave(clean.length ? clean : null);
  }

  return (
    <div className="space-y-1">
      {labelEl}
      <div className="space-y-1.5">
        {slots.map((slot, i) => (
          <Input
            key={i}
            type={inputType}
            value={slot}
            disabled={!canEdit || disabled}
            placeholder={`${def.label} ${i + 1}`}
            onChange={(e) =>
              setSlots((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))
            }
            onBlur={() => commit(slots)}
          />
        ))}
      </div>
    </div>
  );
}
