import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CaseCardFin } from "@/components/cases/CaseCardFin";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { StageEditor } from "@/components/cases/StageEditor";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCasesList, useMoveCaseStatusFin } from "@/hooks/useCases";
import { useServiceTypes, useStages } from "@/hooks/usePipeline";
import { MACRO_FIN_LABELS, type MacroFin } from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/financeiro/")({
  component: CasosFinanceiro,
});

function roleColor(role: string): string {
  switch (role) {
    case "won":
      return "var(--success)";
    case "lost":
      return "var(--danger)";
    case "closed":
      return "var(--muted-foreground)";
    default:
      return "var(--navy)";
  }
}

function CasosFinanceiro() {
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const { data, isLoading, isError, error } = useCasesList(search ? { search } : undefined);
  const move = useMoveCaseStatusFin();

  // Carrega tipos de serviço para pegar etapas financeiras configuráveis
  const { data: serviceTypes } = useServiceTypes();
  const firstType = serviceTypes?.[0];
  const { data: dbStages } = useStages(firstType?.id ?? "", "fin");

  // Colunas: usa etapas do banco se disponíveis, senão fallback para constantes
  const columns: KanbanColumn<string>[] = useMemo(() => {
    if (dbStages && dbStages.length > 0) {
      return dbStages
        .filter((s) => s.slug !== "NAO_APLICAVEL")
        .map((s) => ({
          id: s.slug,
          label: s.label,
          toneColor: roleColor(s.stage_role),
        }));
    }
    // Fallback: constantes hardcoded
    const fallbackSlugs: MacroFin[] = [
      "ELABORANDO", "APROVACAO", "AGUARDANDO_ATIVACAO", "ATIVO",
      "QUITANDO", "QUITADO", "INADIMPLENTE", "PARCIAL",
      "RENEGOCIADO", "SUSPENSO", "CANCELADO",
    ];
    return fallbackSlugs.map((slug) => ({
      id: slug,
      label: MACRO_FIN_LABELS[slug],
      toneColor: "var(--navy)",
    }));
  }, [dbStages]);

  // Só casos já bifurcados aparecem (macrostatus_fin != NAO_APLICAVEL)
  const bifurcated = useMemo(
    () => (data ?? []).filter((c) => c.macrostatus_fin !== "NAO_APLICAVEL"),
    [data],
  );

  const total = bifurcated.length;
  const naoBifurcados = (data ?? []).length - total;

  function handleMove(id: string, to: string) {
    move.mutate(
      { id, to: to as MacroFin },
      {
        onSuccess: () => {
          const col = columns.find((c) => c.id === to);
          toast.success(`Financeiro movido pra ${col?.label ?? to}`);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Falha ao mover o financeiro"),
      },
    );
  }

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
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
            <Btn variant="ghost" onClick={() => setEditorOpen(true)} disabled={!firstType}>
              <Settings2 size={14} />
              Editar etapas
            </Btn>
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

      {firstType && (
        <StageEditor
          serviceTypeId={firstType.id}
          serviceTypeName={firstType.name}
          kind="fin"
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}

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
        columns={columns}
        items={bifurcated}
        isLoading={isLoading}
        getId={(c) => c.id}
        getColumn={(c) => c.macrostatus_fin}
        renderCard={(c) => <CaseCardFin caso={c} />}
        onMove={handleMove}
      />
    </div>
  );
}
