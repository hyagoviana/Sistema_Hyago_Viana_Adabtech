import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateCaseCanonicalFields } from "@/hooks/useCases";
import { FIES_FIELD_KEYS } from "@/lib/cases/fies-fields";

// Bloco "Dados do serviço" — campos canônicos do CASO (ex.: nº FIES).
// Distinto dos custom fields de CLIENTE. MVP: pares chave/valor livres.
export function CaseCanonicalFields({
  caseId,
  canonicalFields,
  canEdit,
}: {
  caseId: string;
  canonicalFields: Record<string, unknown> | null | undefined;
  canEdit: boolean;
}) {
  const updateMut = useUpdateCaseCanonicalFields();
  // Campos FIES (R5-06) têm UI estruturada própria (FiesFields) e gravam no
  // mesmo canonical_fields; filtra-os aqui para não duplicar a edição nem
  // permitir corromper o domínio fechado pelo bloco de pares livres.
  const fiesKeys = FIES_FIELD_KEYS as readonly string[];
  const entries = Object.entries(canonicalFields ?? {}).filter(([k]) => !fiesKeys.includes(k));

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

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

  async function saveValue(key: string, value: string) {
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: value.trim() || null } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
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
        Campos do caso (ex.: nº do contrato FIES). Distintos dos dados do cliente. Buscáveis.
      </p>

      <div className="mt-4 space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campo preenchido.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map(([key, value]) => (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0 font-medium text-[var(--navy)]">{key}</span>
                {canEdit ? (
                  <Input
                    defaultValue={String(value ?? "")}
                    onBlur={(e) => saveValue(key, e.target.value)}
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
        )}
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
