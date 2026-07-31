// R2-09 (reunião 2026-07-22) — Pop-up de FILTROS do tema. Mostra os filtros
// customizados do TEMA (defs de system_tema_field_defs); preenchimento OPCIONAL;
// cada campo grava em system_cases.canonical_fields. Abre depois de concluir o
// Word e também pelo botão "Preencher filtros" no topo da ficha do caso.
//
// SELETOR DE CASO: se o CLIENTE tiver mais de um caso ASSINADO neste tema, um
// seletor no topo permite escolher para QUAL caso o preenchimento vai (os filtros
// são por caso). Fecha sozinho se o tema não tem filtros customizados.

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TemaFieldInput } from "@/components/cases/CaseCanonicalFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCasesList, useUpdateCaseCanonicalFields } from "@/hooks/useCases";
import { useClient, useUpdateClientCustomFields } from "@/hooks/useClients";
import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";

type SiblingCase = {
  id: string;
  case_code?: string | null;
  caso_pasta_nome?: string | null;
  tema_id?: string | null;
  lifecycle?: string | null;
  canonical_fields?: Record<string, unknown> | null;
};

// Rótulo curto do estágio, para diferenciar os casos no seletor.
function lifecycleLabel(lc?: string | null): string {
  if (lc === "CLIENTE") return "cliente";
  if (lc === "LEAD") return "lead";
  if (lc === "PERDIDO") return "perdido";
  return lc ? lc.toLowerCase() : "";
}

export function CaseFilterFillDialog({
  open,
  onOpenChange,
  caseId,
  clientId,
  temaId,
  frenteSlug,
  initialValues,
  enableCaseSelector = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  /** Cliente do caso — habilita o seletor de caso quando há mais de um. */
  clientId?: string | null;
  temaId?: string | null;
  frenteSlug?: string | null;
  /** Valores já existentes no caso (canonical_fields) para pré-carregar. */
  initialValues?: Record<string, unknown> | null;
  /**
   * Mostra o seletor "qual caso" (só o botão "Preencher filtros" do topo usa).
   * No pós-Word é SEMPRE o caso que está sendo gerado — sem seletor.
   */
  enableCaseSelector?: boolean;
}) {
  const { data: defsData, isLoading } = useTemaFieldDefs(temaId ?? null, frenteSlug ?? null);
  const defs = (defsData as TemaFieldDef[] | undefined) ?? [];
  const updateMut = useUpdateCaseCanonicalFields();
  const updateClientMut = useUpdateClientCustomFields();
  // #3 — custom_fields do cliente, para PRÉ-CARREGAR os campos scope='cliente'.
  const { data: clienteData } = useClient(clientId ?? "");
  const clientCf = useMemo(
    () =>
      ((clienteData as { custom_fields?: Record<string, unknown> | null } | undefined)
        ?.custom_fields ?? {}) as Record<string, unknown>,
    [clienteData],
  );

  // Casos do mesmo cliente NESTE tema (seletor) — inclui leads/aguardando, não só
  // os assinados. Escopo por cliente (cache); o seletor só usa isto quando
  // enableCaseSelector (botão do topo).
  const { data: clientCasesData } = useCasesList(clientId ? { client_id: clientId } : undefined);
  const siblingCases = useMemo<SiblingCase[]>(() => {
    if (!enableCaseSelector || !clientId) return [];
    const all = (clientCasesData ?? []) as SiblingCase[];
    const inTema = all.filter((c) => c.tema_id === temaId);
    if (!inTema.some((c) => c.id === caseId)) {
      const cur = all.find((c) => c.id === caseId);
      if (cur) inTema.unshift(cur);
    }
    return inTema;
  }, [clientCasesData, clientId, temaId, caseId, enableCaseSelector]);

  const [selectedCaseId, setSelectedCaseId] = useState(caseId);
  useEffect(() => {
    if (open) setSelectedCaseId(caseId);
  }, [open, caseId]);

  const selectedCase = siblingCases.find((c) => c.id === selectedCaseId);

  const [values, setValues] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (!open) return;
    // Caso atual → usa os valores frescos passados (initialValues). Outros casos
    // do seletor → usam o canonical_fields DAQUELE caso. Nunca herda de outro caso.
    const canon =
      selectedCaseId === caseId
        ? (initialValues ?? selectedCase?.canonical_fields ?? null)
        : (selectedCase?.canonical_fields ?? null);
    // #3 — campos scope='cliente' vêm do cliente; os do caso, do canonical. Sem
    // colisão de chave (def única por tema), o merge preserva cada fonte.
    setValues({ ...clientCf, ...((canon as Record<string, unknown>) ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCaseId, selectedCase, clientCf]);

  // Sem filtros customizados no tema → nada a preencher: fecha sozinho.
  useEffect(() => {
    if (open && !isLoading && defs.length === 0) onOpenChange(false);
  }, [open, isLoading, defs.length, onOpenChange]);

  async function save(def: TemaFieldDef, v: string | number | boolean | string[] | null) {
    setValues((s) => ({ ...s, [def.key]: v }));
    try {
      if (def.scope === "cliente") {
        if (!clientId) {
          toast.error("Caso sem cliente vinculado — não dá para salvar campo do cliente.");
          return;
        }
        await updateClientMut.mutateAsync({ id: clientId, patch: { [def.key]: v } });
      } else {
        await updateMut.mutateAsync({ id: selectedCaseId, patch: { [def.key]: v } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar campo");
    }
  }

  if (!open || (!isLoading && defs.length === 0)) return null;

  const showSelector = siblingCases.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preencher campos do tema</DialogTitle>
          <DialogDescription>
            Opcional — preencha os campos deste caso (pode deixar em branco). Eles alimentam a busca
            e a visualização em lista do tema.
          </DialogDescription>
        </DialogHeader>

        {showSelector && (
          <div className="space-y-1">
            <Label className="text-xs">Caso deste cliente</Label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full py-2 px-3 bg-[var(--card)] border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
            >
              {siblingCases.map((c) => {
                const lc = lifecycleLabel(c.lifecycle);
                return (
                  <option key={c.id} value={c.id}>
                    {(c.case_code ?? c.id) +
                      (c.caso_pasta_nome ? ` — ${c.caso_pasta_nome}` : "") +
                      (lc ? ` (${lc})` : "")}
                  </option>
                );
              })}
            </select>
            <p className="text-[10.5px] text-muted-foreground">
              Este cliente tem mais de um caso neste tema. Escolha para qual caso o preenchimento
              vai.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Carregando campos…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {defs.map((def) => (
              // key inclui o caso selecionado → re-monta os inputs (defaultValue/
              // estado local) ao trocar de caso, refletindo os valores certos.
              <TemaFieldInput
                key={`${selectedCaseId}-${def.id}`}
                def={def}
                value={values[def.key]}
                canEdit
                disabled={updateMut.isPending || updateClientMut.isPending}
                onSave={(v) => save(def, v)}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
