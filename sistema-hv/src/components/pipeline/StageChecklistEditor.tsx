import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useChecklistDefs,
  useCreateChecklistDef,
  useDeleteChecklistDef,
  useReorderChecklistDefs,
  useSetChecklistDefAssignees,
  useUpdateChecklistDef,
} from "@/hooks/useChecklist";
import { useAssignableUsers } from "@/hooks/useUsers";

type Def = {
  id: string;
  key: string;
  label: string;
  ordem: number;
  required: boolean;
  active: boolean;
  expected_doc_pattern: string | null;
  assigned_to?: string | null;
  assignee_ids?: string[];
};

// (item 7) — multi-seleção de responsáveis (checkboxes num dropdown leve, sem deps).
function MultiUserSelect({
  options,
  value,
  disabled,
  onChange,
}: {
  options: { id: string; name: string }[];
  value: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const selected = options.filter((o) => value.includes(o.id));
  const label =
    selected.length === 0
      ? "Sem responsável"
      : selected.length === 1
        ? selected[0].name
        : `${selected.length} responsáveis`;
  return (
    <details className="relative shrink-0">
      <summary className="cursor-pointer list-none max-w-[160px] truncate rounded-md border border-[var(--border)] bg-white px-1.5 py-1 text-[12px]">
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
                <span className="truncate">{o.name}</span>
              </label>
            );
          })
        )}
      </div>
    </details>
  );
}

export function StageChecklistEditor({
  serviceTypeId,
  stageSlug,
  canEdit,
}: {
  serviceTypeId: string;
  stageSlug: string;
  canEdit: boolean;
}) {
  const { data: defs, isLoading } = useChecklistDefs(serviceTypeId, stageSlug);
  const { data: users } = useAssignableUsers();
  const createMut = useCreateChecklistDef();
  const updateMut = useUpdateChecklistDef();
  const deleteMut = useDeleteChecklistDef();
  const reorderMut = useReorderChecklistDefs();
  const defAssignMut = useSetChecklistDefAssignees();

  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [newAssignees, setNewAssignees] = useState<string[]>([]);

  // Responsável vem dos usuários ativos (cadastro de permissões). Não obrigatório.
  const assignees = (users ?? [])
    .filter((u) => u.status === "ACTIVE")
    .map((u) => ({ id: u.id, name: u.full_name || u.email }));

  const list = (defs ?? []) as Def[];
  const busy =
    createMut.isPending || updateMut.isPending || deleteMut.isPending || reorderMut.isPending;

  async function add() {
    const label = newLabel.trim();
    if (!label) {
      toast.error("Informe o nome do item");
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        service_type_id: serviceTypeId,
        stage_slug: stageSlug,
        label,
        required: newRequired,
        assigned_to: newAssignees[0] ?? null,
      });
      // Define o conjunto COMPLETO de responsáveis (múltiplos) da nova etapa.
      if (newAssignees.length > 1 && (created as { id?: string })?.id) {
        await defAssignMut.mutateAsync({
          defId: (created as { id: string }).id,
          userIds: newAssignees,
        });
      }
      setNewLabel("");
      setNewRequired(false);
      setNewAssignees([]);
      toast.success("Item adicionado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar item");
    }
  }

  async function setAssignees(d: Def, userIds: string[]) {
    try {
      await defAssignMut.mutateAsync({ defId: d.id, userIds });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular responsável");
    }
  }

  async function toggleRequired(d: Def) {
    try {
      await updateMut.mutateAsync({ id: d.id, patch: { required: !d.required } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alterar item");
    }
  }

  async function remove(d: Def) {
    if (
      !confirm(
        `Excluir o item "${d.label}"? Ele será removido do checklist de TODOS os casos desta etapa.`,
      )
    )
      return;
    try {
      await deleteMut.mutateAsync(d.id);
      toast.success("Item excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir item");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const arr = [...list];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    try {
      await reorderMut.mutateAsync(arr.map((d) => d.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reordenar");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Checklist da etapa
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item nesta etapa ainda.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((d, i) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-md border bg-white px-2.5 py-1.5 text-sm"
            >
              {canEdit && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || busy}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === list.length - 1 || busy}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
              )}
              <span className="flex-1 min-w-0">{d.label}</span>
              {d.required && <Badge tone="navy">Obrigatório</Badge>}
              {canEdit && (
                <>
                  <MultiUserSelect
                    options={assignees}
                    value={d.assignee_ids ?? (d.assigned_to ? [d.assigned_to] : [])}
                    disabled={busy}
                    onChange={(ids) => setAssignees(d, ids)}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Obrig.
                    <Switch checked={d.required} onCheckedChange={() => toggleRequired(d)} />
                  </label>
                  <button
                    type="button"
                    title="Excluir item"
                    onClick={() => remove(d)}
                    disabled={busy}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Novo item de checklist…"
            className="max-w-[280px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <MultiUserSelect options={assignees} value={newAssignees} onChange={setNewAssignees} />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Obrigatório
            <Switch checked={newRequired} onCheckedChange={setNewRequired} />
          </label>
          <Button type="button" size="sm" variant="outline" onClick={add} disabled={busy}>
            <Plus size={13} className="mr-1" /> Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
