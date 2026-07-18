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
import { useUpdateCaseCanonicalFields } from "@/hooks/useCases";
import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";
import { FIES_FIELD_KEYS } from "@/lib/cases/fies-fields";
import { maskBrlReais, normalizeBrl } from "@/lib/format";

// Bloco "Dados do serviço" — campos canônicos do CASO (ex.: nº FIES).
// Distinto dos custom fields de CLIENTE. O VALOR grava sempre em
// system_cases.canonical_fields (S2-07) via updateCaseCanonicalFields (INALTERADO).
//
// R2-07: quando o caso tem `temaId`, renderiza os campos DEFINIDOS para o
// tema+frente (label/type/ordem/required), MAIS as chaves livres remanescentes
// que não têm def (para não esconder/perder valores já gravados). Sem tema,
// comportamento legado: pares chave/valor livres.

function centavosToReaisMask(centavos: unknown): string {
  if (centavos === null || centavos === undefined || centavos === "") return "";
  const n = typeof centavos === "number" ? centavos : parseInt(String(centavos), 10);
  if (!Number.isFinite(n)) return "";
  return maskBrlReais((n / 100).toFixed(2).replace(".", ","));
}

function reaisMaskToCentavos(masked: string): string {
  const cleaned = (masked ?? "").replace(/[^\d,]/g, "");
  if (cleaned === "") return "";
  const [intRaw, decRaw = ""] = cleaned.split(",");
  const intNum = intRaw ? parseInt(intRaw, 10) : 0;
  const dec = (decRaw + "00").slice(0, 2);
  return String(intNum * 100 + parseInt(dec, 10));
}

function optionsToArray(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

export function CaseCanonicalFields({
  caseId,
  canonicalFields,
  canEdit,
  temaId,
  frenteSlug,
}: {
  caseId: string;
  canonicalFields: Record<string, unknown> | null | undefined;
  canEdit: boolean;
  temaId?: string | null;
  frenteSlug?: string | null;
}) {
  const updateMut = useUpdateCaseCanonicalFields();
  // R2-07 — defs do tema+frente (só quando o caso tem tema).
  const { data: defsData } = useTemaFieldDefs(temaId ?? null, frenteSlug ?? null);
  const defs = (defsData as TemaFieldDef[] | undefined) ?? [];

  // Campos FIES (R5-06) têm UI estruturada própria (FiesFields) e gravam no
  // mesmo canonical_fields; filtra-os aqui para não duplicar a edição.
  const fiesKeys = FIES_FIELD_KEYS as readonly string[];
  const defKeys = new Set(defs.map((d) => d.key));

  const cf = canonicalFields ?? {};
  // Chaves LIVRES remanescentes = tudo que não é FIES e não tem def. Mantidas
  // visíveis/editáveis no modo chave/valor para NUNCA perder valores já gravados.
  const freeEntries = Object.entries(cf).filter(([k]) => !fiesKeys.includes(k) && !defKeys.has(k));

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  async function saveKey(key: string, value: string | number | null) {
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: value } });
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

      {/* R2-07 — campos DEFINIDOS para o tema+frente. */}
      {defs.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {defs.map((def) => (
            <TemaFieldInput
              key={def.id}
              def={def}
              value={cf[def.key]}
              canEdit={canEdit}
              disabled={updateMut.isPending}
              onSave={(v) => saveKey(def.key, v)}
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
function TemaFieldInput({
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
  onSave: (value: string | number | null) => void;
}) {
  const strValue = value === null || value === undefined ? "" : String(value);

  const labelEl = (
    <Label className="flex items-center gap-1">
      {def.label}
      {def.required && <span className="text-destructive">*</span>}
    </Label>
  );

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
  const [mask, setMask] = useState(() => centavosToReaisMask(strValue));
  return (
    <div className="space-y-1">
      {labelEl}
      <Input
        value={mask}
        disabled={!canEdit || disabled}
        inputMode="decimal"
        placeholder="0,00"
        onChange={(e) => setMask(maskBrlReais(e.target.value))}
        onBlur={() => {
          const norm = normalizeBrl(mask);
          setMask(norm);
          const centavos = reaisMaskToCentavos(norm);
          onSave(centavos === "" ? null : centavos);
        }}
      />
    </div>
  );
}
