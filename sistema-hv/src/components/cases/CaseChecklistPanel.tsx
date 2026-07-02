import { AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCaseChecklistItems, useMarcarItemChecklist } from "@/hooks/useChecklist";

type Item = {
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
            <ul className="space-y-1.5">
              {arr.map((it) => {
                const isSuggestion = it.source === "drive_suggest" && !it.done;
                return (
                  <li
                    key={it.id}
                    className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm ${
                      isSuggestion ? "border-[var(--gold)] bg-[var(--cream)]" : ""
                    }`}
                  >
                    <Checkbox
                      checked={it.done}
                      disabled={marcarMut.isPending}
                      onCheckedChange={(v) => toggle(it, !!v)}
                    />
                    <span
                      className={`flex-1 ${it.done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {it.def?.label ?? it.def?.key ?? "—"}
                    </span>
                    {it.def?.required && (
                      <Badge className="bg-[var(--navy)] text-white">Obrigatório</Badge>
                    )}
                    {isSuggestion && (
                      <>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--gold-700)]">
                          <Sparkles size={12} /> Sugestão
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={marcarMut.isPending}
                          onClick={() => toggle(it, true)}
                        >
                          Confirmar
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
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
