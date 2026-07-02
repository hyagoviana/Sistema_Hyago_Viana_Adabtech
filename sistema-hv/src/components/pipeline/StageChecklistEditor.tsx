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
  useUpdateChecklistDef,
} from "@/hooks/useChecklist";

type Def = {
  id: string;
  key: string;
  label: string;
  ordem: number;
  required: boolean;
  active: boolean;
  expected_doc_pattern: string | null;
};

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
  const createMut = useCreateChecklistDef();
  const updateMut = useUpdateChecklistDef();
  const deleteMut = useDeleteChecklistDef();
  const reorderMut = useReorderChecklistDefs();

  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(false);

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
      await createMut.mutateAsync({
        service_type_id: serviceTypeId,
        stage_slug: stageSlug,
        label,
        required: newRequired,
      });
      setNewLabel("");
      setNewRequired(false);
      toast.success("Item adicionado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar item");
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
      !confirm(`Excluir o item "${d.label}"? Itens já concluídos em casos existentes permanecem.`)
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
