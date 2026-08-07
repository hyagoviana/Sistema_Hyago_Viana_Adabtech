import { useEffect } from "react";
import { FolderKanban, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBoards, useBoardStages } from "@/hooks/useBoards";
import { useStages } from "@/hooks/usePipeline";
import { TemaWikiBoard } from "@/components/pipeline/TemaWikiBoard";

// C4 (Reunião 2026-08-05) — pop-up de seleção de KANBAN ao entrar num TEMA com
// >1 kanban. Decisão do owner: POP-UP (não "página do meio").
//
// Comportamento:
//   • Enquanto os boards carregam → spinner curto no dialog.
//   • Resolveu e há SÓ 1 board (só o principal) → navega DIRETO ao principal e
//     fecha, sem renderizar os quadradinhos (paridade com o comportamento antigo).
//   • Há >1 board (principal + ≥1 custom) → mostra um grid de quadradinhos, um por
//     board, com título + prévia dos funis (etapas). Clicar navega ao board.
//
// Reusa `useBoards`/`DynamicKanban` (o search param `board` já roteia a esteira).
// Hospeda também o quadro de "Links úteis"/wiki do tema (C5), por `temaId`.

type BoardRow = {
  id: string;
  label: string;
  is_principal: boolean;
  ordem: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceType: { id: string; name: string };
  // tema_id do tema clicado — usado para montar o quadro de "Links úteis" (C5).
  temaId?: string | null;
  // Navega para o board escolhido (null = principal). O chamador semeia o search
  // param `board` e fecha o pop-up.
  onNavigate: (boardId: string | null) => void;
};

// Prévia LEVE de um funil: contagem de etapas + as 3 primeiras labels em sequência.
function funnelPreview(labels: string[]): string {
  if (labels.length === 0) return "Sem etapas";
  const head = labels.slice(0, 3).join(" · ");
  const rest = labels.length - 3;
  return rest > 0 ? `${head} · +${rest}` : head;
}

export function KanbanPickerDialog({ open, onOpenChange, serviceType, temaId, onNavigate }: Props) {
  const { data: boards, isLoading } = useBoards(serviceType.id);
  const list = ((boards ?? []) as BoardRow[])
    .slice()
    .sort((a, b) => Number(b.is_principal) - Number(a.is_principal) || a.ordem - b.ordem);

  // Regra "entra direto com 1 kanban": quando aberto e os boards resolveram com
  // <=1 board, navega ao principal e fecha SEM renderizar os quadradinhos.
  useEffect(() => {
    if (open && !isLoading && list.length <= 1) {
      onNavigate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading, list.length]);

  const showGrid = !isLoading && list.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[82vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{serviceType.name}</DialogTitle>
          <DialogDescription>
            Escolha em qual kanban entrar. Cada quadro é um sub-fluxo do mesmo tema.
          </DialogDescription>
        </DialogHeader>

        {!showGrid ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
            <Loader2 size={16} className="animate-spin text-[var(--gold)]" />
            Abrindo…
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((b) =>
              b.is_principal ? (
                <PrincipalCard
                  key={b.id}
                  serviceTypeId={serviceType.id}
                  label={b.label}
                  onPick={() => onNavigate(null)}
                />
              ) : (
                <CustomCard key={b.id} board={b} onPick={() => onNavigate(b.id)} />
              ),
            )}
          </div>
        )}

        {/* C5 — quadro de "Links úteis"/wiki do TEMA, na entrada (junto ao pop-up). */}
        {showGrid && temaId ? (
          <div className="mt-1 border-t border-[var(--border)] pt-3">
            <TemaWikiBoard temaId={temaId} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Quadradinho do board PRINCIPAL — a prévia vem das etapas op (kind='op').
function PrincipalCard({
  serviceTypeId,
  label,
  onPick,
}: {
  serviceTypeId: string;
  label: string;
  onPick: () => void;
}) {
  const { data: stages } = useStages(serviceTypeId, "op");
  const labels = (stages ?? []).map((s) => (s as { label: string }).label);
  return (
    <BoardCard label={label} badge="Principal" preview={funnelPreview(labels)} onPick={onPick} />
  );
}

// Quadradinho de um board CUSTOM — a prévia vem das etapas do board (lazy).
function CustomCard({ board, onPick }: { board: BoardRow; onPick: () => void }) {
  const { data: stages } = useBoardStages(board.id);
  const labels = (stages ?? []).map((s) => (s as { label: string }).label);
  return <BoardCard label={board.label} preview={funnelPreview(labels)} onPick={onPick} />;
}

function BoardCard({
  label,
  badge,
  preview,
  onPick,
}: {
  label: string;
  badge?: string;
  preview: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="card-hero p-4 text-left w-full hover:border-[var(--gold)] transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}
        >
          <FolderKanban size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[var(--navy)] truncate">
            {label}
            {badge && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                {badge}
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-muted-foreground truncate">{preview}</div>
        </div>
      </div>
    </button>
  );
}
