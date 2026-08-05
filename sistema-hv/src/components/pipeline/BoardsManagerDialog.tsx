import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
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
  useUpdateBoardStage,
} from "@/hooks/useBoards";

// A3 / AJUSTE #2 (item 1) — gestão das LISTAS/KANBANS de um tema (admin).
//
// CORREÇÃO DO BUG PRINCIPAL: "Criar novo kanban" cria um BOARD NOVO
// (system_pipeline_boards, is_principal=false) e o usuário define as ETAPAS DESSE
// board (system_pipeline_stages com board_id = o novo board) — etapas PRÓPRIAS,
// independentes do kanban-mãe (principal). Este diálogo JAMAIS edita as etapas do
// board principal: as etapas do principal são as do operacional e vivem em
// "Editar etapas". O backend (createBoardStage) também bloqueia editar etapas do
// principal (defesa em profundidade).
//
// Campos/filtros são do TEMA (mesmos em TODOS os kanbans) — este diálogo NÃO
// define campo/filtro por board (regra dura da reunião).
type Props = {
  serviceTypeId: string;
  serviceTypeName: string;
  principalBoardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Item 2 — quando aberto a partir do "Editar etapas" de um kanban CUSTOM, abre
  // já expandido nas etapas daquele board (edita só as etapas dele).
  focusBoardId?: string | null;
};

export function BoardsManagerDialog({
  serviceTypeId,
  serviceTypeName,
  open,
  onOpenChange,
  focusBoardId,
}: Props) {
  const { data: boards } = useBoards(serviceTypeId);
  const createBoard = useCreateBoard(serviceTypeId);
  const updateBoard = useUpdateBoard(serviceTypeId);
  const deleteBoard = useDeleteBoard(serviceTypeId);

  const [newBoard, setNewBoard] = useState("");
  // Kanban expandido (mostra o editor de etapas DAQUELE board). Ao criar um novo
  // kanban, expandimos automaticamente para o usuário já escrever suas etapas.
  const [expanded, setExpanded] = useState<string | null>(null);

  // Item 2 — ao abrir com foco num board (via "Editar etapas" do kanban custom),
  // expande esse board para editar as etapas dele diretamente.
  useEffect(() => {
    if (open && focusBoardId) setExpanded(focusBoardId);
  }, [open, focusBoardId]);

  const principal = (boards ?? []).find((b) => b.is_principal) ?? null;
  const custom = (boards ?? []).filter((b) => !b.is_principal);

  async function handleCreateBoard() {
    const label = newBoard.trim();
    if (!label) return;
    try {
      // (a) Cria o BOARD NOVO (is_principal=false) — NÃO uma etapa no principal.
      const created = await createBoard.mutateAsync({ service_type_id: serviceTypeId, label });
      setNewBoard("");
      // (b) Abre o editor de ETAPAS PRÓPRIAS do board recém-criado.
      setExpanded((created as { id: string }).id);
      toast.success(`Kanban "${label}" criado — agora defina as etapas dele abaixo`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar kanban");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kanbans do tema — {serviceTypeName}</DialogTitle>
          <DialogDescription>
            Cada kanban é um sub-fluxo do mesmo caso, com <strong>etapas próprias</strong>. Os
            campos e filtros são os mesmos do tema em todos os kanbans (compartilhados).
          </DialogDescription>
        </DialogHeader>

        {/* Novo kanban — no TOPO para deixar claro que é a ação principal. Ao criar,
            o kanban abre já expandido para o usuário escrever as etapas dele. */}
        <div className="rounded-md border border-[var(--gold)]/40 bg-[var(--gold)]/5 p-3 space-y-2">
          <div className="text-[13px] font-medium text-[var(--navy)]">Criar novo kanban</div>
          <div className="flex items-center gap-2">
            <Input
              value={newBoard}
              onChange={(e) => setNewBoard(e.target.value)}
              placeholder="Nome do novo kanban (ex.: Cobrança de documento)"
              onKeyDown={(e) => e.key === "Enter" && handleCreateBoard()}
            />
            <Button
              onClick={handleCreateBoard}
              disabled={!newBoard.trim() || createBoard.isPending}
            >
              {createBoard.isPending ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Plus size={14} className="mr-1" />
              )}
              Criar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cria um kanban com etapas próprias (não altera o kanban principal). Depois de criar,
            escreva as etapas dele.
          </p>
        </div>

        {/* Board principal (informativo, não editável aqui) */}
        <div className="rounded-md border border-[var(--border)] p-3 bg-[var(--muted)]/40">
          <div className="text-[13px] font-medium text-[var(--navy)]">
            {principal?.label ?? "Principal"}{" "}
            <span className="text-[11px] text-muted-foreground font-normal">
              · principal (etapas no "Editar etapas")
            </span>
          </div>
        </div>

        {/* Kanbans custom — cada um com suas etapas próprias */}
        <div className="space-y-2">
          {custom.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nenhum kanban extra ainda.</p>
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
                    if (expanded === b.id) setExpanded(null);
                    toast.success("Kanban excluído");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Falha ao excluir");
                  }
                }}
              />
            ))
          )}
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
  // Só carrega as etapas DESTE board (escopo por board_id) quando expandido.
  const { data: stages } = useBoardStages(expanded ? board.id : null);
  const createStage = useCreateBoardStage(board.id);
  const updateStage = useUpdateBoardStage(board.id);
  const deleteStage = useDeleteBoardStage(board.id);
  const [newStage, setNewStage] = useState("");

  async function handleAddStage() {
    const l = newStage.trim();
    if (!l) return;
    try {
      // Etapa PRÓPRIA do board (board_id = board.id). Nunca toca o principal.
      // NÃO enviamos slug: o serviço gera um slug INTERNO ÚNICO a partir do label
      // (owner quer poder repetir nomes de etapa livremente e recriar após excluir).
      await createStage.mutateAsync({
        board_id: board.id,
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
          title="Excluir kanban"
          className="p-1.5 rounded-md text-destructive hover:bg-[var(--muted)] transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Etapas deste kanban
          </div>
          {(stages ?? []).length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nenhuma etapa. Adicione abaixo.</p>
          ) : (
            (stages ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 text-[13px] py-1 px-2 rounded bg-[var(--muted)]/40"
              >
                <Input
                  defaultValue={s.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.label) updateStage.mutate({ id: s.id, patch: { label: v } });
                  }}
                  className="h-7 text-[13px] flex-1 border-transparent bg-transparent focus:border-[var(--gold)]"
                />
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
