import { ArrowLeft, FolderKanban, Loader2 } from "lucide-react";

import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { useBoards, useBoardStages } from "@/hooks/useBoards";
import { useStages } from "@/hooks/usePipeline";
import { TemaWikiBoard } from "@/components/pipeline/TemaWikiBoard";

// C4/C5 (correção 2026-08-07) — PÁGINA intermediária de escolha de kanban (não mais
// pop-up). Ao clicar num TEMA na Pipeline Operacional, SEMPRE cai aqui — mesmo que o
// tema tenha só 1 kanban. A página mostra:
//   • um card por KANBAN do tema (principal + customs), com os FUNIS listados EM TÓPICOS;
//   • embaixo de tudo, o bloco de NOTAS + LINKS do tema (TemaWikiBoard / C5).
// Escolher um kanban navega para a esteira daquele board.

type BoardRow = {
  id: string;
  label: string;
  is_principal: boolean;
  ordem: number;
};

type Props = {
  serviceTypeId: string;
  name: string;
  // tema_id do tema clicado — usado para o bloco de notas/links (C5).
  temaId: string | null;
  // Navega para o board escolhido (null = principal / esteira operacional).
  onPick: (boardId: string | null) => void;
  onBack: () => void;
};

export function KanbanPickerPage({ serviceTypeId, name, temaId, onPick, onBack }: Props) {
  const { data: boards, isLoading } = useBoards(serviceTypeId);
  const list = ((boards ?? []) as BoardRow[])
    .slice()
    .sort((a, b) => Number(b.is_principal) - Number(a.is_principal) || a.ordem - b.ordem);

  return (
    <div className="page-container !pb-10">
      <Breadcrumb
        items={[
          { label: "Operação", to: "/hoje" },
          { label: "Área de Trabalho", to: "/pipeline" },
          { label: name },
        ]}
      />
      <PageHeader
        eyebrow="Operação"
        title={name}
        subtitle="Escolha em qual kanban entrar. Cada quadro é um sub-fluxo do mesmo tema."
        aside={
          <Btn variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} />
            Voltar aos temas
          </Btn>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground">
          <Loader2 size={16} className="animate-spin text-[var(--gold)]" />
          Carregando kanbans…
        </div>
      ) : (
        /* #18a (2026-08-17) — disposição em ⅔/⅓: os KANBANS (grade) à esquerda e
           os LINKS ÚTEIS / AVISOS do tema à direita, na mesma altura (antes o
           wiki ficava numa faixa isolada embaixo). */
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <div className="grid sm:grid-cols-2 gap-4">
              {list.map((b) =>
                b.is_principal ? (
                  <PrincipalCard
                    key={b.id}
                    serviceTypeId={serviceTypeId}
                    label={b.label}
                    onPick={() => onPick(null)}
                  />
                ) : (
                  <CustomCard key={b.id} board={b} onPick={() => onPick(b.id)} />
                ),
              )}
            </div>
          </div>
          {/* C5 — bloco de notas + links úteis / avisos do TEMA. */}
          {temaId ? (
            <div className="min-w-0">
              <TemaWikiBoard temaId={temaId} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Card do board PRINCIPAL — os funis vêm das etapas op (kind='op').
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
  return <BoardCard label={label} badge="Principal" funnels={labels} onPick={onPick} />;
}

// Card de um board CUSTOM — os funis vêm das etapas do board (lazy).
function CustomCard({ board, onPick }: { board: BoardRow; onPick: () => void }) {
  const { data: stages } = useBoardStages(board.id);
  const labels = (stages ?? []).map((s) => (s as { label: string }).label);
  return <BoardCard label={board.label} funnels={labels} onPick={onPick} />;
}

function BoardCard({
  label,
  badge,
  funnels,
  onPick,
}: {
  label: string;
  badge?: string;
  funnels: string[];
  onPick: () => void;
}) {
  return (
    <div className="card-hero p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}
        >
          <FolderKanban size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[var(--navy)] truncate">
            {label}
            {badge && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                {badge}
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            {funnels.length} {funnels.length === 1 ? "funil" : "funis"}
          </div>
        </div>
      </div>

      {/* Funis EM TÓPICOS */}
      {funnels.length > 0 ? (
        <ul className="text-[12.5px] text-[var(--navy)] space-y-1 pl-1">
          {funnels.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shrink-0" />
              <span className="truncate">{f}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[12px] text-muted-foreground">Sem funis cadastrados.</div>
      )}

      <Btn variant="gold" onClick={onPick} className="mt-auto w-full justify-center">
        Entrar →
      </Btn>
    </div>
  );
}
