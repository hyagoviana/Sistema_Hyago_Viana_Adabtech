import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, List, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CaseCardReal } from "@/components/cases/CaseCardReal";
import { CaseFormDialog } from "@/components/cases/CaseFormDialog";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCasesList, useMoveCaseStatus } from "@/hooks/useCases";
import { MACRO_OP, MACRO_OP_LABELS, type MacroOp } from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/")({
  component: CasosKanban,
});

const COLUMN_TONE: Record<MacroOp, string> = {
  ONBOARDING: "neutral",
  ANALISE: "neutral",
  CONFERENCIA: "navy",
  PRONTO_AJUIZAR: "gold",
  EM_ANDAMENTO: "gold",
  AGUARDANDO_DECISAO: "warning",
  IMPLANTADO: "success",
  IMPLANTACAO_PARCIAL: "success",
  ENCERRADO: "neutral",
  CANCELADO: "danger",
};

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--muted-foreground)",
  navy: "var(--navy)",
  gold: "var(--gold-700)",
  warning: "var(--warning)",
  success: "var(--success)",
  danger: "var(--danger)",
};

const COLUMNS: KanbanColumn<MacroOp>[] = MACRO_OP.map((col) => ({
  id: col,
  label: MACRO_OP_LABELS[col],
  toneColor: TONE_COLOR[COLUMN_TONE[col]],
}));

function CasosKanban() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError, error } = useCasesList(search ? { search } : undefined);
  const move = useMoveCaseStatus();

  const total = data?.length ?? 0;

  function handleMove(id: string, to: MacroOp) {
    move.mutate(
      { id, to },
      {
        onSuccess: () => toast.success(`Movido pra ${MACRO_OP_LABELS[to]}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao mover o caso"),
      },
    );
  }

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Pipeline Operacional" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Operacional"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} em ${MACRO_OP.length} estados operacionais.`
        }
        aside={
          <div className="flex items-center gap-2">
            <Link to="/casos/lista">
              <Btn variant="ghost">
                <List size={14} />
                Ver lista
              </Btn>
            </Link>
            <Btn variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Novo caso
            </Btn>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou próximo passo…"
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <Btn variant="outline" size="sm" disabled>
          <Filter size={13} />
          Filtros (em breve)
        </Btn>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar casos: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      <KanbanBoard
        columns={COLUMNS}
        items={data ?? []}
        isLoading={isLoading}
        getId={(c) => c.id}
        getColumn={(c) => c.macrostatus_op as MacroOp}
        renderCard={(c) => <CaseCardReal caso={c} />}
        onMove={handleMove}
      />

      <CaseFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
