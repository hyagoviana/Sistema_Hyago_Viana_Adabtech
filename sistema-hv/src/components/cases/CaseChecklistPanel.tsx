import { Link } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ChecklistItemsRows, type ChecklistItem as Item } from "./ChecklistItemsList";
import { Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useCaseChecklistItems,
  useCreateAdhocChecklistItem,
  useDeleteAdhocChecklistItem,
  useMarcarItemChecklist,
  useSetChecklistItemAssignees,
  useUpdateAdhocChecklistItem,
} from "@/hooks/useChecklist";
import { useAssignableUsers } from "@/hooks/useUsers";

// #3 (reunião 2026-08-17) — Checklist de UMA etapa, SEM card/título/explicação.
// Serve para ficar aninhado logo abaixo do card da etapa no Rastro (o card acima
// já mostra o kanban+etapa), eliminando a duplicação e o texto "Ao concluir…".
// Reusa os mesmos hooks: a query de itens é cacheada por caseId, então múltiplas
// instâncias (uma por etapa) compartilham os dados sem refetch.
export function CaseStageChecklist({
  caseId,
  stageSlug,
  canEdit = false,
  className,
}: {
  caseId: string;
  stageSlug: string;
  canEdit?: boolean;
  className?: string;
}) {
  const { data: items, isLoading } = useCaseChecklistItems(caseId);
  const { data: users } = useAssignableUsers();
  const marcarMut = useMarcarItemChecklist(caseId);
  const createMut = useCreateAdhocChecklistItem(caseId);
  const updateMut = useUpdateAdhocChecklistItem(caseId);
  const deleteMut = useDeleteAdhocChecklistItem(caseId);
  const assignMut = useSetChecklistItemAssignees(caseId);
  const [editing, setEditing] = useState<Item | null>(null);

  const assignees = (users ?? [])
    .filter((u) => u.status === "ACTIVE")
    .map((u) => ({ id: u.id, full_name: u.full_name, email: u.email }));

  const list = ((items ?? []) as Item[])
    .filter((it) => it.stage_slug === stageSlug)
    .sort((a, b) => (a.def?.ordem ?? 0) - (b.def?.ordem ?? 0));
  const busy =
    marcarMut.isPending || createMut.isPending || updateMut.isPending || deleteMut.isPending;

  async function toggle(item: Item, done: boolean) {
    try {
      await marcarMut.mutateAsync({ itemId: item.id, done });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao marcar item");
    }
  }
  async function assign(item: Item, userIds: string[]) {
    try {
      await assignMut.mutateAsync({ itemId: item.id, userIds });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular responsável");
    }
  }
  async function removeAdhoc(item: Item) {
    if (!confirm(`Excluir o critério "${item.def?.label ?? ""}" deste caso?`)) return;
    try {
      await deleteMut.mutateAsync(item.id);
      toast.success("Critério excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir critério");
    }
  }

  if (isLoading) return null;
  // Sem itens e sem permissão de editar → não ocupa espaço embaixo do card.
  if (list.length === 0 && !canEdit) return null;

  return (
    <div className={className}>
      {list.length > 0 ? (
        <ChecklistItemsRows
          items={list}
          onToggle={toggle}
          pending={busy}
          onEditAdhoc={canEdit ? (it) => setEditing(it) : undefined}
          onDeleteAdhoc={canEdit ? removeAdhoc : undefined}
          assignees={canEdit ? assignees : undefined}
          onAssign={canEdit ? assign : undefined}
        />
      ) : (
        <p className="text-[12px] text-muted-foreground">Nenhum critério nesta etapa.</p>
      )}
      {canEdit && (
        <AddAdhocForm
          disabled={busy}
          onAdd={async (label, required) => {
            try {
              await createMut.mutateAsync({ stageSlug, label, required });
              toast.success("Critério adicionado");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Falha ao adicionar critério");
            }
          }}
        />
      )}
      <EditAdhocDialog
        item={editing}
        onClose={() => setEditing(null)}
        busy={updateMut.isPending}
        onSave={async (patch) => {
          if (!editing) return;
          try {
            await updateMut.mutateAsync({ itemId: editing.id, patch });
            toast.success("Critério atualizado");
            setEditing(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao editar critério");
          }
        }}
      />
    </div>
  );
}

// Formulário inline p/ acrescentar um critério AD-HOC na etapa atual.
function AddAdhocForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (label: string, required: boolean) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(true);

  async function submit() {
    const clean = label.trim();
    if (!clean) {
      toast.error("Informe o nome do critério");
      return;
    }
    await onAdd(clean, required);
    setLabel("");
    setRequired(true);
  }

  return (
    <div className="flex items-center gap-2 pt-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Critério específico deste caso…"
        className="max-w-[280px] h-8 text-[13px]"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Obrigatório
        <Switch checked={required} onCheckedChange={setRequired} disabled={disabled} />
      </label>
      <Button type="button" size="sm" variant="outline" onClick={submit} disabled={disabled}>
        <Plus size={13} className="mr-1" /> Adicionar
      </Button>
    </div>
  );
}

// Dialog p/ editar label/obrigatoriedade de um critério AD-HOC.
function EditAdhocDialog({
  item,
  onClose,
  onSave,
  busy,
}: {
  item: Item | null;
  onClose: () => void;
  onSave: (patch: { label?: string; required?: boolean }) => Promise<void>;
  busy: boolean;
}) {
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(true);
  const [initId, setInitId] = useState<string | null>(null);

  // Semeia os campos quando o dialog abre p/ um item diferente.
  if (item && item.id !== initId) {
    setInitId(item.id);
    setLabel(item.def?.label ?? "");
    setRequired(item.def?.required ?? false);
  }

  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setInitId(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar critério deste caso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome do critério</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={required} onCheckedChange={setRequired} disabled={busy} />
            Obrigatório (bloqueia o avanço da etapa enquanto não concluído)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave({ label: label.trim(), required })}
            disabled={busy || !label.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          sozinho · reveja o item ou mova o caso manualmente.
        </p>
      </div>
    </div>
  );
}
