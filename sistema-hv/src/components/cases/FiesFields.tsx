import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
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
import {
  FIES_FIELD_DEFS,
  FIES_KEY_VALOR_CENTAVOS,
  type FiesFieldDef,
} from "@/lib/cases/fies-fields";
import { maskBrlReais, normalizeBrl } from "@/lib/format";

// Story R5-06 (A2) — campos ESTRUTURADOS do contrato FIES (domínio fechado).
// SÓ aparece em casos FIES (o pai decide via isCasoFies). Grava nos MESMOS
// system_cases.canonical_fields de S2-07 (via updateCaseCanonicalFields) — sem
// duplicar armazenamento e sem tocar em custom_fields do cliente. Convive ao
// lado do bloco de pares chave/valor livres (CaseCanonicalFields).
//
// Valor monetário: guardado em CENTAVOS (string do inteiro) na chave
// `fies_valor_centavos`, como o resto do financeiro.

// "1.234,56" (reais mascarado) → centavos (inteiro). "" → "".
function reaisMaskToCentavos(masked: string): string {
  const cleaned = (masked ?? "").replace(/[^\d,]/g, "");
  if (cleaned === "") return "";
  const [intRaw, decRaw = ""] = cleaned.split(",");
  const intNum = intRaw ? parseInt(intRaw, 10) : 0;
  const dec = (decRaw + "00").slice(0, 2);
  return String(intNum * 100 + parseInt(dec, 10));
}

// centavos (string) → "1.234,56" (reais mascarado p/ o input).
function centavosToReaisMask(centavos: string | undefined): string {
  if (!centavos) return "";
  const n = parseInt(centavos, 10);
  if (!Number.isFinite(n)) return "";
  return maskBrlReais((n / 100).toFixed(2).replace(".", ","));
}

export function FiesFields({
  caseId,
  canonicalFields,
  canEdit,
}: {
  caseId: string;
  canonicalFields: Record<string, unknown> | null | undefined;
  canEdit: boolean;
}) {
  const updateMut = useUpdateCaseCanonicalFields();
  const cf = canonicalFields ?? {};

  const [valorMask, setValorMask] = useState(() =>
    centavosToReaisMask(
      typeof cf[FIES_KEY_VALOR_CENTAVOS] === "string" ||
        typeof cf[FIES_KEY_VALOR_CENTAVOS] === "number"
        ? String(cf[FIES_KEY_VALOR_CENTAVOS])
        : undefined,
    ),
  );

  async function save(key: string, value: string | null) {
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: value || null } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar campo FIES");
    }
  }

  function currentValue(key: string): string {
    const v = cf[key];
    return typeof v === "string" || typeof v === "number" ? String(v) : "";
  }

  return (
    <div className="card-hero p-7">
      <Eyebrow>Dados do contrato FIES</Eyebrow>
      <p className="text-[12px] text-muted-foreground mt-1">
        Campos estruturados do contrato (buscáveis; alimentam triagem e documentos).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIES_FIELD_DEFS.map((def: FiesFieldDef) => {
          if (def.type === "money") {
            return (
              <div key={def.key} className="space-y-1">
                <Label>{def.label} (R$)</Label>
                <Input
                  value={valorMask}
                  disabled={!canEdit || updateMut.isPending}
                  inputMode="decimal"
                  placeholder="0,00"
                  onChange={(e) => setValorMask(maskBrlReais(e.target.value))}
                  onBlur={() => {
                    const norm = normalizeBrl(valorMask);
                    setValorMask(norm);
                    save(FIES_KEY_VALOR_CENTAVOS, reaisMaskToCentavos(norm) || null);
                  }}
                />
              </div>
            );
          }

          const value = currentValue(def.key);
          return (
            <div key={def.key} className="space-y-1">
              <Label>{def.label}</Label>
              <Select
                value={value || undefined}
                disabled={!canEdit || updateMut.isPending}
                onValueChange={(v) => save(def.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(def.options ?? []).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
