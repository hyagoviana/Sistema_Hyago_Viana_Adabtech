import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CaseCardReal } from "@/components/cases/CaseCardReal";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useCasesByServiceType,
  useMoveCaseStageOp,
  useServiceTypes,
  useStages,
} from "@/hooks/usePipeline";

export const Route = createFileRoute("/pipeline")({
  component: PipelinePage,
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

function PipelinePage() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  if (selected) {
    return <DynamicKanban serviceType={selected} onBack={() => setSelected(null)} />;
  }
  return <ServiceTypeSelection onPick={setSelected} />;
}

function ServiceTypeSelection({ onPick }: { onPick: (t: { id: string; name: string }) => void }) {
  const { data: types, isLoading } = useServiceTypes();

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Pipeline Operacional" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Operacional"
        subtitle="Escolha o tipo de serviço para abrir a esteira específica."
      />

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando tipos…</div>
      ) : (types ?? []).length === 0 ? (
        <Alert>
          <AlertDescription>Nenhum tipo de serviço cadastrado.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(types ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick({ id: t.id, name: t.name })}
              className="card-hero p-6 text-left hover:border-[var(--gold)] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-white"
                  style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}
                >
                  <FolderKanban size={20} />
                </div>
                <div>
                  <div className="font-display text-[18px] font-semibold text-[var(--navy)]">
                    {t.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground">Abrir esteira →</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DynamicKanban({
  serviceType,
  onBack,
}: {
  serviceType: { id: string; name: string };
  onBack: () => void;
}) {
  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, "op");
  const { data: cases, isLoading, isError, error } = useCasesByServiceType(serviceType.id);
  const move = useMoveCaseStageOp(serviceType.id);

  const columns: KanbanColumn<string>[] = (stages ?? []).map((s) => ({
    id: s.slug,
    label: s.label,
    toneColor: roleColor(s.stage_role),
  }));

  function handleMove(id: string, toSlug: string) {
    const stage = (stages ?? []).find((s) => s.slug === toSlug);
    if (!stage) return;
    move.mutate(
      { caseId: id, stageId: stage.id },
      {
        onSuccess: () => toast.success(`Movido pra ${stage.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao mover"),
      },
    );
  }

  const total = cases?.length ?? 0;

  return (
    <div className="page-container !pb-10">
      <Breadcrumb
        items={[
          { label: "Operação", to: "/hoje" },
          { label: "Pipeline Operacional" },
          { label: serviceType.name },
        ]}
      />
      <PageHeader
        eyebrow="Esteira"
        title={serviceType.name}
        subtitle={
          isLoading || stagesLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} em ${columns.length} etapas.`
        }
        aside={
          <Btn variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} />
            Trocar tipo
          </Btn>
        }
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar casos: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {!stagesLoading && columns.length === 0 ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Layers size={15} /> Este tipo ainda não tem etapas operacionais cadastradas.
          </AlertDescription>
        </Alert>
      ) : (
        <KanbanBoard
          columns={columns}
          items={cases ?? []}
          isLoading={isLoading || stagesLoading}
          getId={(c) => c.id}
          getColumn={(c) => c.macrostatus_op}
          renderCard={(c) => <CaseCardReal caso={c} />}
          onMove={handleMove}
        />
      )}
    </div>
  );
}
