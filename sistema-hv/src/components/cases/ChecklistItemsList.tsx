// S6-02 — Lista de itens do checklist do caso, compartilhada entre a FICHA
// (CaseChecklistPanel, agrupado por etapa) e o CARD do Kanban financeiro
// (CaseCardFin, filtrado pela etapa atual). Reusa useCaseChecklistItems /
// useMarcarItemChecklist — o mesmo caminho de marcação/gate da ficha.

import { Pencil, Sparkles, Trash2, User } from "lucide-react";
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
  // item 3 — responsável (usuário do sistema) por este critério.
  assigned_to?: string | null;
  // 2b — conjunto COMPLETO de responsáveis (múltiplos) do item.
  assignee_ids?: string[];
  // S9-11 — item específico deste caso (def_id IS NULL). Herdados do modelo = false.
  is_adhoc?: boolean;
  def: {
    key: string;
    label: string;
    ordem: number;
    required: boolean;
    expected_doc_pattern: string | null;
  } | null;
};

export type AssigneeOption = { id: string; full_name: string | null; email: string };

// (2b) — seletor de MÚLTIPLOS responsáveis (checkboxes num dropdown leve, sem deps).
function AssigneeMultiSelect({
  options,
  value,
  disabled,
  onChange,
}: {
  options: AssigneeOption[];
  value: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const nameOf = (o: AssigneeOption) => o.full_name || o.email;
  const selected = options.filter((o) => value.includes(o.id));
  const label =
    selected.length === 0
      ? "Sem responsável"
      : selected.length === 1
        ? nameOf(selected[0])
        : `${selected.length} responsáveis`;
  return (
    <details className="relative shrink-0">
      <summary
        className="cursor-pointer list-none max-w-[160px] truncate rounded-md border border-[var(--border)] bg-white px-1.5 py-1 text-[12px]"
        title="Responsáveis por este critério"
      >
        {label}
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-56 max-h-60 overflow-auto rounded-md border border-[var(--border)] bg-white p-1 shadow-lg">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-[12px] text-muted-foreground">Nenhum usuário.</div>
        ) : (
          options.map((o) => {
            const checked = value.includes(o.id);
            return (
              <label
                key={o.id}
                className="flex items-center gap-2 px-2 py-1 text-[12px] rounded hover:bg-[var(--ink-50)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onChange(checked ? value.filter((v) => v !== o.id) : [...value, o.id])
                  }
                />
                <span className="truncate">{nameOf(o)}</span>
              </label>
            );
          })
        )}
      </div>
    </details>
  );
}

// Render puro de uma lista de itens já resolvida (sem fetch). Usado pela ficha,
// que agrupa por etapa e passa cada grupo já ordenado.
export function ChecklistItemsRows({
  items,
  onToggle,
  pending,
  compact = false,
  onEditAdhoc,
  onDeleteAdhoc,
  assignees,
  onAssign,
}: {
  items: ChecklistItem[];
  onToggle: (item: ChecklistItem, done: boolean) => void;
  pending: boolean;
  compact?: boolean;
  // S9-11 — quando fornecidos, habilita editar/excluir dos itens AD-HOC (só eles).
  onEditAdhoc?: (item: ChecklistItem) => void;
  onDeleteAdhoc?: (item: ChecklistItem) => void;
  // item 3/2b — quando fornecidos, mostra o seletor de RESPONSÁVEIS (múltiplos) por item.
  assignees?: AssigneeOption[];
  onAssign?: (item: ChecklistItem, userIds: string[]) => void;
}) {
  const showAssignee = !compact && !!assignees && !!onAssign;
  return (
    <ul className={compact ? "space-y-1" : "space-y-1.5"}>
      {items.map((it) => {
        const isSuggestion = it.source === "drive_suggest" && !it.done;
        const isAdhoc = it.is_adhoc === true;
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
            {showAssignee && (
              <AssigneeMultiSelect
                options={assignees!}
                value={it.assignee_ids ?? (it.assigned_to ? [it.assigned_to] : [])}
                disabled={pending}
                onChange={(ids) => onAssign!(it, ids)}
              />
            )}
            {isAdhoc && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-[var(--gold-700)] shrink-0"
                title="Critério específico deste caso (não vem do modelo do tipo de serviço)"
              >
                <User size={11} /> Deste caso
              </span>
            )}
            {isAdhoc && onEditAdhoc && (
              <button
                type="button"
                title="Editar critério"
                onClick={() => onEditAdhoc(it)}
                disabled={pending}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
              >
                <Pencil size={13} />
              </button>
            )}
            {isAdhoc && onDeleteAdhoc && (
              <button
                type="button"
                title="Excluir critério"
                onClick={() => onDeleteAdhoc(it)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive disabled:opacity-30 shrink-0"
              >
                <Trash2 size={13} />
              </button>
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
