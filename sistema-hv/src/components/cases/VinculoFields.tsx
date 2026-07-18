import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateCase, useUpdateCaseCanonicalFields } from "@/hooks/useCases";
import { VINCULO_FIELD_DEFS, type VinculoFieldDef } from "@/lib/cases/vinculo-fields";

// Story R1-05 (N2 / B1) — bloco "Vínculo no caso": o vínculo/papel da pessoa
// NAQUELE caso. É do CASO, nunca da pessoa (a mesma pessoa pode ter município/
// vínculo distintos em cada caso). Segue o mesmo padrão visual de FiesFields.
//
// Armazenamento:
//   - `município` → COLUNA dedicada system_cases.municipio (via updateCase).
//     Reusa o valor de `caso.municipio`. NÃO vai para canonical_fields.
//   - vínculo empregatício / papel → system_cases.canonical_fields (S2-07),
//     nas chaves NAMESPACED `vinculo_*` (via updateCaseCanonicalFields). Merge
//     por caso — não sobrescreve o vínculo de outro caso.
//
// NUNCA grava em system_clients (custom_fields / professional_data).

export function VinculoFields({
  caseId,
  municipio,
  canonicalFields,
  canEdit,
}: {
  caseId: string;
  municipio: string | null | undefined;
  canonicalFields: Record<string, unknown> | null | undefined;
  canEdit: boolean;
}) {
  const updateCaseMut = useUpdateCase();
  const updateCanonMut = useUpdateCaseCanonicalFields();
  const cf = canonicalFields ?? {};
  const pending = updateCaseMut.isPending || updateCanonMut.isPending;

  // Município → COLUNA dedicada do caso (não canonical). Reusa caso.municipio.
  async function saveMunicipio(value: string | null) {
    try {
      await updateCaseMut.mutateAsync({ id: caseId, input: { municipio: value || null } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar município");
    }
  }

  // Vínculo/papel → canonical_fields (chaves vinculo_*), merge por caso.
  async function saveCanon(key: string, value: string | null) {
    try {
      await updateCanonMut.mutateAsync({ id: caseId, patch: { [key]: value || null } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar vínculo");
    }
  }

  function currentValue(key: string): string {
    const v = cf[key];
    return typeof v === "string" || typeof v === "number" ? String(v) : "";
  }

  return (
    <div className="card-hero p-7">
      <Eyebrow>Vínculo no caso</Eyebrow>
      <p className="text-[12px] text-muted-foreground mt-1">
        Vínculo/papel da pessoa NESTE caso (não é atributo fixo da pessoa; pode variar entre casos).
        Alimentam documentos.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Município — coluna dedicada do caso. */}
        <div className="space-y-1">
          <Label>Município de atuação</Label>
          <Input
            defaultValue={municipio ?? ""}
            disabled={!canEdit || pending}
            placeholder="Ex.: São Paulo"
            onBlur={(e) => {
              const raw = e.target.value.trim();
              if (raw !== (municipio ?? "").trim()) saveMunicipio(raw || null);
            }}
          />
        </div>

        {/* Vínculo empregatício + papel — canonical_fields (vinculo_*). */}
        {VINCULO_FIELD_DEFS.map((def: VinculoFieldDef) => {
          const value = currentValue(def.key);
          return (
            <div key={def.key} className="space-y-1">
              <Label>{def.label}</Label>
              <Input
                defaultValue={value}
                disabled={!canEdit || pending}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw !== value) saveCanon(def.key, raw || null);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
