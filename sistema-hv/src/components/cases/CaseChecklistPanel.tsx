import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { ChecklistItemsRows, type ChecklistItem as Item } from "./ChecklistItemsList";
import { Eyebrow } from "@/components/hv/primitives";
import { useCaseChecklistItems, useMarcarItemChecklist } from "@/hooks/useChecklist";

export function CaseChecklistPanel({ caseId }: { caseId: string }) {
  const { data: items, isLoading } = useCaseChecklistItems(caseId);
  const marcarMut = useMarcarItemChecklist(caseId);

  const list = (items ?? []) as Item[];

  async function toggle(item: Item, done: boolean) {
    try {
      await marcarMut.mutateAsync({ itemId: item.id, done });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao marcar item");
    }
  }

  if (isLoading) {
    return (
      <div className="card-hero p-7">
        <Eyebrow>Checklist</Eyebrow>
        <p className="text-sm text-muted-foreground mt-2">Carregando…</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="card-hero p-7">
        <Eyebrow>Checklist da etapa</Eyebrow>
        <p className="text-sm text-muted-foreground mt-2">
          Nenhum item de checklist para a etapa atual. Configure os itens no editor de funil.
        </p>
      </div>
    );
  }

  // Agrupa por etapa (stage_slug), ordena itens por def.ordem.
  const byStage = new Map<string, Item[]>();
  for (const it of list) {
    const arr = byStage.get(it.stage_slug) ?? [];
    arr.push(it);
    byStage.set(it.stage_slug, arr);
  }
  for (const arr of byStage.values()) {
    arr.sort((a, b) => (a.def?.ordem ?? 0) - (b.def?.ordem ?? 0));
  }

  return (
    <div className="card-hero p-7">
      <Eyebrow>Checklist da etapa</Eyebrow>
      <p className="text-[12px] text-muted-foreground mt-1">
        Ao concluir todos os itens obrigatórios da etapa atual, o caso avança sozinho.
      </p>
      <div className="mt-4 space-y-5">
        {[...byStage.entries()].map(([slug, arr]) => (
          <div key={slug}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              {slug}
            </div>
            <ChecklistItemsRows items={arr} onToggle={toggle} pending={marcarMut.isPending} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Alerta de inconsistência (S2-05 CA-3) — exibido quando há eventos
// 'checklist_inconsistente' na timeline do caso.
export function ChecklistInconsistencyAlert({
  events,
}: {
  events: { action: string; diff: unknown }[] | undefined;
}) {
  const inconsistencies = (events ?? []).filter((e) => e.action === "checklist_inconsistente");
  if (inconsistencies.length === 0) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3"
      style={{ background: "rgba(180,35,24,0.05)", border: "1px solid rgba(180,35,24,0.25)" }}
    >
      <AlertTriangle size={18} className="text-[var(--danger)] mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-[var(--danger)]">Checklist inconsistente</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Um item obrigatório de uma etapa já ultrapassada foi desmarcado. O caso NÃO regride
          sozinho — reveja o item ou mova o caso manualmente.
        </p>
      </div>
    </div>
  );
}
