import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StageChecklistEditor } from "@/components/pipeline/StageChecklistEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type StageKind,
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/hooks/usePipeline";

function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const ROLE_LABELS: Record<string, string> = {
  normal: "Normal",
  won: "Ganho (vai p/ financeiro)",
  lost: "Perdido",
  closed: "Encerrado",
};

export function StageEditor({
  serviceTypeId,
  serviceTypeName,
  kind,
  open,
  onOpenChange,
  canEdit = true,
}: {
  serviceTypeId: string;
  serviceTypeName: string;
  kind: StageKind;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit?: boolean;
}) {
  const { data: stages } = useStages(serviceTypeId, kind);
  const createStage = useCreateStage(serviceTypeId, kind);
  const updateStage = useUpdateStage(serviceTypeId, kind);
  const reorder = useReorderStages(serviceTypeId, kind);
  const del = useDeleteStage(serviceTypeId, kind);

  const [newLabel, setNewLabel] = useState("");
  // S6-01 — etapa com o checklist de critérios expandido (id da etapa aberta).
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = stages ?? [];

  async function addStage() {
    const label = newLabel.trim();
    if (!label) return;
    const slug = slugify(label) || `ETAPA_${list.length + 1}`;
    if (list.some((s) => s.slug === slug)) {
      toast.error("Já existe uma etapa com esse nome");
      return;
    }
    try {
      await createStage.mutateAsync({
        service_type_id: serviceTypeId,
        kind,
        slug,
        label,
        ordem: list.length,
      });
      setNewLabel("");
      toast.success("Etapa criada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  }

  async function swap(i: number, j: number) {
    if (j < 0 || j >= list.length) return;
    const ids = list.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await reorder.mutateAsync(ids);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reordenar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Etapas — {serviceTypeName}</DialogTitle>
          <DialogDescription>
            Crie, renomeie, reordene ou remova as etapas{" "}
            {kind === "op" ? "operacionais" : kind === "fin" ? "financeiras" : "comerciais"}.
            “Ganho” marca a etapa que dispara o financeiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {list.map((s, i) => (
            <div key={s.id} className="border border-[var(--border)] rounded-md">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-[var(--navy)]"
                  title="Critérios (checklist) desta etapa"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  {expanded === s.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-[var(--navy)] disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => swap(i, i - 1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-[var(--navy)] disabled:opacity-30"
                    disabled={i === list.length - 1}
                    onClick={() => swap(i, i + 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
                <Input
                  className="flex-1"
                  defaultValue={s.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.label) updateStage.mutate({ id: s.id, patch: { label: v } });
                  }}
                />
                <Select
                  value={s.stage_role}
                  onValueChange={(v) => updateStage.mutate({ id: s.id, patch: { stage_role: v } })}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, lbl]) => (
                      <SelectItem key={k} value={k}>
                        {lbl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Excluir"
                  onClick={async () => {
                    try {
                      await del.mutateAsync(s.id);
                      toast.success("Etapa removida");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Falha");
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {expanded === s.id && (
                <div className="border-t border-[var(--border)] bg-muted/20 px-4 py-3">
                  <StageChecklistEditor
                    serviceTypeId={serviceTypeId}
                    stageSlug={s.slug}
                    canEdit={canEdit}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] pt-3">
          <Label>Nova etapa</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nome da etapa"
              onKeyDown={(e) => e.key === "Enter" && addStage()}
            />
            <Button onClick={addStage} disabled={createStage.isPending || !newLabel.trim()}>
              {createStage.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
