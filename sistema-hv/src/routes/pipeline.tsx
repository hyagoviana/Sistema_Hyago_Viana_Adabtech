import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban, Layers, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CaseCardReal } from "@/components/cases/CaseCardReal";
import { CaseFormDialog } from "@/components/cases/CaseFormDialog";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { StageEditor } from "@/components/cases/StageEditor";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCasesByServiceType,
  useCreateServiceType,
  useMoveCaseStageFin,
  useMoveCaseStageOp,
  useServiceTypes,
  useStages,
} from "@/hooks/usePipeline";

function slugifyCat(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

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
  const createCat = useCreateServiceType();
  const [newOpen, setNewOpen] = useState(false);
  const [createCaseOpen, setCreateCaseOpen] = useState(false);
  const [catName, setCatName] = useState("");

  async function criarCategoria() {
    const name = catName.trim();
    if (!name) return;
    try {
      await createCat.mutateAsync({
        name,
        slug: slugifyCat(name) || `CAT_${(types?.length ?? 0) + 1}`,
      });
      toast.success("Categoria criada (já com etapas padrão — edite como quiser)");
      setCatName("");
      setNewOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar categoria");
    }
  }

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Pipeline Operacional" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Operacional"
        subtitle="Escolha o tipo de caso para abrir a esteira específica."
        aside={
          <div className="flex items-center gap-2">
            <Btn variant="gold" onClick={() => setCreateCaseOpen(true)}>
              <Plus size={14} />
              Novo caso
            </Btn>
            <Btn variant="ghost" onClick={() => setNewOpen(true)}>
              <Plus size={14} />
              Nova categoria
            </Btn>
          </div>
        }
      />

      <CaseFormDialog open={createCaseOpen} onOpenChange={setCreateCaseOpen} />

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria de pipeline</DialogTitle>
            <DialogDescription>
              Crie uma nova esteira (ex.: Trabalhista, Possessória). Ela nasce com etapas padrão que
              você edita depois.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nome da categoria</Label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Ex.: Trabalhista"
              onKeyDown={(e) => e.key === "Enter" && criarCategoria()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criarCategoria} disabled={createCat.isPending || !catName.trim()}>
              {createCat.isPending ? "Criando…" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando casos…</div>
      ) : (types ?? []).length === 0 ? (
        <Alert>
          <AlertDescription>Nenhum tipo de caso cadastrado.</AlertDescription>
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
                  <div className="text-[15px] font-semibold text-[var(--navy)]">{t.name}</div>
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
  const [kind, setKind] = useState<"op" | "fin">("op");
  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, kind);
  const { data: allCases, isLoading, isError, error } = useCasesByServiceType(serviceType.id);
  const moveOp = useMoveCaseStageOp(serviceType.id);
  const moveFin = useMoveCaseStageFin(serviceType.id);
  const [editorOpen, setEditorOpen] = useState(false);

  // Financeiro mostra só casos bifurcados (com etapa financeira ativa).
  // Operacional esconde os casos "somente financeiro" (S19 / ADR-016) — filtro SÓ aqui,
  // nunca na fonte/view, senão o caso sumiria das duas pipelines.
  const cases =
    kind === "fin"
      ? (allCases ?? []).filter((c) => c.macrostatus_fin && c.macrostatus_fin !== "NAO_APLICAVEL")
      : (allCases ?? []).filter(
          (c) => !(c as { removido_do_operacional_at?: string | null }).removido_do_operacional_at,
        );

  const columns: KanbanColumn<string>[] = (stages ?? [])
    .filter((s) => !(kind === "fin" && s.slug === "NAO_APLICAVEL"))
    .map((s) => ({ id: s.slug, label: s.label, toneColor: roleColor(s.stage_role) }));

  function handleMove(id: string, toSlug: string) {
    const stage = (stages ?? []).find((s) => s.slug === toSlug);
    if (!stage) return;
    const mover = kind === "op" ? moveOp : moveFin;
    mover.mutate(
      { caseId: id, stageId: stage.id },
      {
        onSuccess: () => toast.success(`Movido pra ${stage.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao mover"),
      },
    );
  }

  const total = cases.length;

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
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
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
              {(["op", "fin"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={
                    kind === k
                      ? "px-3 py-1.5 bg-[var(--navy)] text-white"
                      : "px-3 py-1.5 text-muted-foreground hover:bg-[var(--muted)]"
                  }
                >
                  {k === "op" ? "Operacional" : "Financeiro"}
                </button>
              ))}
            </div>
            <Btn variant="ghost" onClick={() => setEditorOpen(true)}>
              <Settings2 size={14} />
              Editar etapas
            </Btn>
            <Btn variant="ghost" onClick={onBack}>
              <ArrowLeft size={14} />
              Trocar tipo
            </Btn>
          </div>
        }
      />

      <StageEditor
        serviceTypeId={serviceType.id}
        serviceTypeName={serviceType.name}
        kind={kind}
        open={editorOpen}
        onOpenChange={setEditorOpen}
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
          getColumn={(c) => (kind === "op" ? c.macrostatus_op : c.macrostatus_fin)}
          renderCard={(c) => <CaseCardReal caso={c} />}
          onMove={handleMove}
        />
      )}
    </div>
  );
}
