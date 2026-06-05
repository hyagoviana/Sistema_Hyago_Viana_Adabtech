import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CaseCardFin } from "@/components/cases/CaseCardFin";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCasesList, useMoveCaseStatusFin } from "@/hooks/useCases";
import { MACRO_FIN, MACRO_FIN_LABELS, type MacroFin } from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/financeiro/")({
  component: CasosFinanceiro,
});

// NAO_APLICAVEL não aparece como coluna — esse estado é "ainda não bifurcado"
const FIN_COLUMNS: MacroFin[] = MACRO_FIN.filter((s) => s !== "NAO_APLICAVEL");

const COLUMN_TONE: Record<MacroFin, string> = {
  NAO_APLICAVEL: "neutral",
  ELABORANDO: "neutral",
  APROVACAO: "navy",
  AGUARDANDO_ATIVACAO: "navy",
  ATIVO: "success",
  QUITANDO: "success",
  QUITADO: "success",
  INADIMPLENTE: "danger",
  PARCIAL: "warning",
  RENEGOCIADO: "warning",
  SUSPENSO: "warning",
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

const COLUMNS: KanbanColumn<MacroFin>[] = FIN_COLUMNS.map((col) => ({
  id: col,
  label: MACRO_FIN_LABELS[col],
  toneColor: TONE_COLOR[COLUMN_TONE[col]],
}));

function CasosFinanceiro() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useCasesList(search ? { search } : undefined);
  const move = useMoveCaseStatusFin();

  // Só casos já bifurcados aparecem (macrostatus_fin != NAO_APLICAVEL)
  const bifurcated = useMemo(
    () => (data ?? []).filter((c) => c.macrostatus_fin !== "NAO_APLICAVEL"),
    [data],
  );

  const total = bifurcated.length;
  const naoBifurcados = (data ?? []).length - total;

  function handleMove(id: string, to: MacroFin) {
    move.mutate(
      { id, to },
      {
        onSuccess: () => toast.success(`Financeiro movido pra ${MACRO_FIN_LABELS[to]}`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Falha ao mover o financeiro"),
      },
    );
  }

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: "Financeiro" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Financeira"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} bifurcado${total === 1 ? "" : "s"}${
                naoBifurcados > 0 ? ` · ${naoBifurcados} ainda não bifurcado(s)` : ""
              }`
        }
        aside={
          <div className="flex items-center gap-2">
            <Link to="/casos">
              <Btn variant="ghost">
                <ArrowLeft size={14} />
                Voltar ao Operacional
              </Btn>
            </Link>
            <Link to="/casos/financeiro/inadimplencia">
              <Btn variant="outline">Inadimplência</Btn>
            </Link>
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
        items={bifurcated}
        isLoading={isLoading}
        getId={(c) => c.id}
        getColumn={(c) => c.macrostatus_fin as MacroFin}
        renderCard={(c) => <CaseCardFin caso={c} />}
        onMove={handleMove}
      />
    </div>
  );
}
