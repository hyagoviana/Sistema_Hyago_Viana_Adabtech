// S6-02 — Lista de itens do checklist do caso, compartilhada entre a FICHA
// (CaseChecklistPanel, agrupado por etapa) e o CARD do Kanban financeiro
// (CaseCardFin, filtrado pela etapa atual). Reusa useCaseChecklistItems /
// useMarcarItemChecklist — o mesmo caminho de marcação/gate da ficha.

import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCaseChecklistItems, useMarcarItemChecklist } from "@/hooks/useChecklist";

export type ChecklistItem = {
  id: string;
  stage_slug: string;
  done: boolean;
  source: string;
  drive_file_id: string | null;
  def: {
    key: string;
    label: string;
    ordem: number;
    required: boolean;
    expected_doc_pattern: string | null;
  } | null;
};

// Render puro de uma lista de itens já resolvida (sem fetch). Usado pela ficha,
// que agrupa por etapa e passa cada grupo já ordenado.
export function ChecklistItemsRows({
  items,
  onToggle,
  pending,
  compact = false,
}: {
  items: ChecklistItem[];
  onToggle: (item: ChecklistItem, done: boolean) => void;
  pending: boolean;
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "space-y-1" : "space-y-1.5"}>
      {items.map((it) => {
        const isSuggestion = it.source === "drive_suggest" && !it.done;
        return (
          <li
            key={it.id}
            className={`flex items-center gap-2.5 rounded-md border text-sm ${
              compact ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2"
            } ${isSuggestion ? "border-[var(--gold)] bg-[var(--cream)]" : ""}`}
          >
            <Checkbox
              checked={it.done}
              disabled={pending}
              onCheckedChange={(v) => onToggle(it, !!v)}
            />
            <span
              className={`flex-1 min-w-0 ${it.done ? "line-through text-muted-foreground" : ""}`}
            >
              {it.def?.label ?? it.def?.key ?? "—"}
            </span>
            {it.def?.required && (
              <Badge className="bg-[var(--navy)] text-white shrink-0">Obrigatório</Badge>
            )}
            {isSuggestion && (
              <>
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--gold-700)] shrink-0">
                  <Sparkles size={12} /> Sugestão
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onToggle(it, true)}
                >
                  Confirmar
                </Button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Wrapper com fetch próprio: carrega os itens do caso e (opcionalmente) filtra
// por etapa (stageSlug). Usado pelo CARD do Kanban financeiro, que só mostra os
// itens da etapa atual do caso.
export function ChecklistItemsList({
  caseId,
  stageSlug,
  compact = false,
}: {
  caseId: string;
  stageSlug?: string;
  compact?: boolean;
}) {
  const { data: items, isLoading } = useCaseChecklistItems(caseId);
  const marcarMut = useMarcarItemChecklist(caseId);

  async function toggle(item: ChecklistItem, done: boolean) {
    try {
      await marcarMut.mutateAsync({ itemId: item.id, done });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao marcar item");
    }
  }

  if (isLoading) {
    return <p className="text-[12px] text-muted-foreground">Carregando…</p>;
  }

  const all = (items ?? []) as ChecklistItem[];
  const list = (stageSlug ? all.filter((it) => it.stage_slug === stageSlug) : all).sort(
    (a, b) => (a.def?.ordem ?? 0) - (b.def?.ordem ?? 0),
  );

  if (list.length === 0) {
    return <p className="text-[12px] text-muted-foreground">Nenhum critério para a etapa atual.</p>;
  }

  return (
    <ChecklistItemsRows
      items={list}
      onToggle={toggle}
      pending={marcarMut.isPending}
      compact={compact}
    />
  );
}
