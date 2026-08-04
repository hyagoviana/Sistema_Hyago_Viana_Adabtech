import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useBoards,
  useBoardStages,
  useCreateBoard,
  useCreateBoardStage,
  useDeleteBoard,
  useDeleteBoardStage,
  useUpdateBoard,
} from "@/hooks/useBoards";

// A3 — gestão das LISTAS/BOARDS de um tema (admin). Criar/renomear/excluir boards
// custom + etapas de cada board. O board PRINCIPAL (espelho do operacional) não é
// editável aqui (suas etapas vivem em "Editar etapas"). Campos/filtros são do TEMA
// e NÃO são configuráveis por board (regra dura da reunião).
type Props = {
  serviceTypeId: string;
  serviceTypeName: string;
  principalBoardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function slugify(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `etapa_${Date.now().toString(36)}`
  );
}

export function BoardsManagerDialog({ serviceTypeId, serviceTypeName, open, onOpenChange }: Props) {
  const { data: boards } = useBoards(serviceTypeId);
  const createBoard = useCreateBoard(serviceTypeId);
  const updateBoard = useUpdateBoard(serviceTypeId);
  const deleteBoard = useDeleteBoard(serviceTypeId);

  const [newBoard, setNewBoard] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const custom = (boards ?? []).filter((b) => !b.is_principal);

  async function handleCreateBoard() {
    const label = newBoard.trim();
    if (!label) return;
    try {
      await createBoard.mutateAsync({ service_type_id: serviceTypeId, label });
      setNewBoard("");
      toast.success(`Lista "${label}" criada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar lista");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Listas do tema — {serviceTypeName}</DialogTitle>
          <DialogDescription>
            Crie sub-fluxos (listas/boards) do mesmo caso, cada um com suas etapas. Os campos e
            filtros são os mesmos do tema em todas as listas.
          </DialogDescription>
        </DialogHeader>

        {/* Board principal (informativo, não editável aqui) */}
        <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--muted)]/40">
          <div className="text-[13px] font-medium text-[var(--navy)]">
            {(boards ?? []).find((b) => b.is_principal)?.label ?? "Principal"}{" "}
            <span className="text-[11px] text-muted-foreground font-normal">
              · principal (etapas no "Editar etapas")
            </span>
          </div>
        </div>

        {/* Listas custom */}
        <div className="space-y-2">
          {custom.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nenhuma lista extra ainda.</p>
          ) : (
            custom.map((b) => (
              <BoardRow
                key={b.id}
                board={b}
                expanded={expanded === b.id}
                onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
                onRename={async (label) => {
                  try {
                    await updateBoard.mutateAsync({ id: b.id, patch: { label } });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Falha ao renomear");
                  }
                }}
                onDelete={async () => {
                  try {
                    await deleteBoard.mutateAsync(b.id);
                    toast.success("Lista excluída");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Falha ao excluir");
                  }
                }}
              />
            ))
          )}
        </div>

        {/* Nova lista */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
          <Input
            value={newBoard}
            onChange={(e) => setNewBoard(e.target.value)}
            placeholder="Nome da nova lista (ex.: Cobrança de documento)"
            onKeyDown={(e) => e.key === "Enter" && handleCreateBoard()}
          />
          <Button onClick={handleCreateBoard} disabled={!newBoard.trim() || createBoard.isPending}>
            <Plus size={14} className="mr-1" /> Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BoardRow({
  board,
  expanded,
  onToggle,
  onRename,
  onDelete,
}: {
  board: { id: string; label: string };
  expanded: boolean;
  onToggle: () => void;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(board.label);
  const { data: stages } = useBoardStages(expanded ? board.id : null);
  const createStage = useCreateBoardStage(board.id);
  const deleteStage = useDeleteBoardStage(board.id);
  const [newStage, setNewStage] = useState("");

  async function handleAddStage() {
    const l = newStage.trim();
    if (!l) return;
    try {
      await createStage.mutateAsync({
        board_id: board.id,
        slug: slugify(l),
        label: l,
        ordem: (stages ?? []).length,
      });
      setNewStage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar etapa");
    }
  }

  return (
    <div className="rounded-md border border-[var(--border)]">
      <div className="flex items-center gap-2 p-2">
        <button type="button" onClick={onToggle} className="text-muted-foreground">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label !== board.label && onRename(label.trim())}
          className="h-8 text-[13px]"
        />
        <button
          type="button"
          onClick={onDelete}
          title="Excluir lista"
          className="p-1.5 rounded-md text-destructive hover:bg-[var(--muted)] transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Etapas</div>
          {(stages ?? []).length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nenhuma etapa. Adicione abaixo.</p>
          ) : (
            (stages ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 text-[13px] py-1 px-2 rounded bg-[var(--muted)]/40"
              >
                <span>{s.label}</span>
                <button
                  type="button"
                  onClick={() => deleteStage.mutate(s.id)}
                  title="Excluir etapa"
                  className="text-destructive/70 hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              placeholder="Nova etapa (ex.: Cobrei 1x)"
              className="h-8 text-[13px]"
              onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddStage}
              disabled={!newStage.trim() || createStage.isPending}
            >
              <Plus size={13} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
