import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StageChecklistEditor } from "@/components/pipeline/StageChecklistEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  useBoardStages,
  useCreateBoardStage,
  useDeleteBoardStage,
  useReorderBoardStages,
  useUpdateBoardStage,
} from "@/hooks/useBoards";
import { GLOBAL_FUNNEL_SERVICE_TYPE_ID } from "@/lib/cases/constants";

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
  boardId = null,
}: {
  serviceTypeId: string;
  serviceTypeName: string;
  kind: StageKind;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit?: boolean;
  // TAREFA A (2026-08-04) — quando setado, o editor opera nas etapas de um board
  // CUSTOM (system_pipeline_stages.board_id) via board-service, em vez das etapas
  // op/fin do principal. Ausente = comportamento do principal (INALTERADO).
  boardId?: string | null;
}) {
  const isBoard = !!boardId;

  // Fontes de dados do PRINCIPAL (op/fin). Hooks sempre chamados (rules-of-hooks);
  // no modo board a query fica desabilitada por não termos serviceType relevante?
  // Não — o serviceTypeId é o mesmo do tema, então mantemos a query barata e só
  // NÃO a usamos. Para evitar leituras desnecessárias no modo board, a lista/mut,
  // efetivamente usadas, são escolhidas abaixo.
  const principalStagesQ = useStages(serviceTypeId, kind);
  const createStagePrincipal = useCreateStage(serviceTypeId, kind);
  const updateStagePrincipal = useUpdateStage(serviceTypeId, kind);
  const reorderPrincipal = useReorderStages(serviceTypeId, kind);
  const delPrincipal = useDeleteStage(serviceTypeId, kind);

  // Fontes de dados do BOARD custom.
  const boardStagesQ = useBoardStages(boardId);
  const createStageBoard = useCreateBoardStage(boardId);
  const updateStageBoard = useUpdateBoardStage(boardId);
  const reorderBoard = useReorderBoardStages(boardId);
  const delBoard = useDeleteBoardStage(boardId);

  // Adapta as duas fontes numa interface única — a JSX abaixo é idêntica p/ ambos.
  const stages = isBoard ? boardStagesQ.data : principalStagesQ.data;
  const createStage = isBoard ? createStageBoard : createStagePrincipal;
  const updateStage = {
    mutate: (vars: { id: string; patch: Record<string, unknown> }) =>
      isBoard
        ? updateStageBoard.mutate(vars as { id: string; patch: { label?: string } })
        : updateStagePrincipal.mutate(vars),
  };
  const reorder = isBoard ? reorderBoard : reorderPrincipal;
  const del = isBoard ? delBoard : delPrincipal;

  const [newLabel, setNewLabel] = useState("");
  // S6-01 — etapa com o checklist de critérios expandido (id da etapa aberta).
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = (stages ?? []) as {
    id: string;
    slug: string;
    label: string;
    stage_role: string;
  }[];

  // ITEM 6.2 — funil ÚNICO (sentinela comercial/fin): compartilhado por TODOS os
  // tipos via SLUG. Criar/excluir etapas AQUI geraria coluna órfã, então só
  // permitimos renomear/reordenar. (O backend também bloqueia — defesa em profundidade.)
  // No modo BOARD nunca é o funil global (boards são sempre por tema, custom).
  const isGlobalFunnel = !isBoard && serviceTypeId === GLOBAL_FUNNEL_SERVICE_TYPE_ID;

  // A5 (2026-08-03) — o checklist por etapa (defs) vale p/ op/fin. No modo BOARD as
  // etapas são kind='op' (namespace de slug próprio) e carregam service_type_id do
  // tema — o StageChecklistEditor é chaveado por (service_type_id, stage_slug), que
  // ambas têm. Comercial segue sem checklist.
  const showChecklist = isBoard || kind === "fin" || kind === "op";

  async function addStage() {
    const label = newLabel.trim();
    if (!label) return;
    // No modo board o slug é gerado no servidor (SEMPRE único). Só validamos
    // duplicidade de slug no principal (onde o slug vem do label).
    if (!isBoard) {
      const slug = slugify(label) || `ETAPA_${list.length + 1}`;
      if (list.some((s) => s.slug === slug)) {
        toast.error("Já existe uma etapa com esse nome");
        return;
      }
      try {
        await createStagePrincipal.mutateAsync({
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
      return;
    }
    try {
      await createStageBoard.mutateAsync({
        board_id: boardId!,
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
            {isGlobalFunnel
              ? "Renomeie e reordene as etapas. Este é o funil ÚNICO (compartilhado por todos os tipos), então criar/excluir etapas está desativado — evita colunas órfãs."
              : "Crie, renomeie, reordene ou remova as etapas."}{" "}
            “Ganho” marca a etapa que dispara o financeiro.
          </DialogDescription>
        </DialogHeader>

        {isGlobalFunnel && (
          <Alert className="mb-1">
            <AlertDescription className="text-xs">
              Funil único ({kind === "fin" ? "financeiro" : "comercial"}): você pode renomear e
              reordenar as etapas. Para adicionar/remover etapas, edite o funil por tipo no
              Operacional.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {list.map((s, i) => (
            <div key={s.id} className="border border-[var(--border)] rounded-md">
              <div className="flex items-center gap-2 p-2">
                {showChecklist && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-[var(--navy)]"
                    title="Critérios (checklist) desta etapa"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  >
                    {expanded === s.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                )}
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
                {!isGlobalFunnel && (
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
                )}
              </div>
              {showChecklist && expanded === s.id && (
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

        {!isGlobalFunnel && (
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
                {createStage.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
