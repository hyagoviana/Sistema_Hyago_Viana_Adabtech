import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban, Search, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CaseCardFin } from "@/components/cases/CaseCardFin";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { StageEditor } from "@/components/cases/StageEditor";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MACRO_FIN_LABELS, type MacroFin } from "@/lib/cases/constants";
import { useAllBifurcatedCases, useCasesByServiceType, useMoveCaseStageFin, useServiceTypes, useStages } from "@/hooks/usePipeline";

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
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (showAll) {
    return <FinanceiroKanbanTodos onBack={() => setShowAll(false)} />;
  }
  if (selected) {
    return <FinanceiroKanban serviceType={selected} onBack={() => setSelected(null)} />;
  }
  return <ServiceTypeSelection onPick={setSelected} onPickAll={() => setShowAll(true)} />;
}

/* ───── Tela de seleção de tipo de serviço (igual ao pipeline operacional) ───── */

function ServiceTypeSelection({
  onPick,
  onPickAll,
}: {
  onPick: (t: { id: string; name: string }) => void;
  onPickAll: () => void;
}) {
  const { data: types, isLoading } = useServiceTypes();

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: "Financeiro" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Financeira"
        subtitle="Escolha o tipo de caso para abrir a esteira financeira."
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

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando tipos…</div>
      ) : (types ?? []).length === 0 ? (
        <Alert>
          <AlertDescription>Nenhum tipo de caso cadastrado.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={onPickAll}
            className="card-hero p-6 text-left hover:border-[var(--gold)] transition-colors group border-[var(--gold)] border-2"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center text-white"
                style={{ background: "linear-gradient(135deg, #1e2044, #3a3d7a)" }}
              >
                <FolderKanban size={20} />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[var(--navy)]">Todos</div>
                <div className="text-[12px] text-muted-foreground">Ver todos os casos na esteira →</div>
              </div>
            </div>
          </button>
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
                  <div className="text-[12px] text-muted-foreground">Abrir esteira financeira →</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───── Kanban financeiro filtrado por tipo de serviço ───── */

function FinanceiroKanban({
  serviceType,
  onBack,
}: {
  serviceType: { id: string; name: string };
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, "fin");
  const { data: allCases, isLoading, isError, error } = useCasesByServiceType(serviceType.id);
  const moveFin = useMoveCaseStageFin(serviceType.id);

  // Só casos bifurcados (macrostatus_fin != NAO_APLICAVEL)
  const bifurcated = useMemo(
    () =>
      (allCases ?? []).filter(
        (c) => c.macrostatus_fin && c.macrostatus_fin !== "NAO_APLICAVEL",
      ),
    [allCases],
  );

  // Filtro de busca local por código ou nome do cliente
  const filtered = useMemo(() => {
    if (!search.trim()) return bifurcated;
    const q = search.toLowerCase();
    return bifurcated.filter(
      (c) =>
        c.case_code.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q),
    );
  }, [bifurcated, search]);

  const columns: KanbanColumn<string>[] = useMemo(
    () =>
      (stages ?? [])
        .filter((s) => s.slug !== "NAO_APLICAVEL")
        .map((s) => ({
          id: s.slug,
          label: s.label,
          toneColor: roleColor(s.stage_role),
        })),
    [stages],
  );

  const total = bifurcated.length;
  const totalAll = (allCases ?? []).length;
  const naoBifurcados = totalAll - total;

  function handleMove(id: string, toSlug: string) {
    const stage = (stages ?? []).find((s) => s.slug === toSlug);
    if (!stage) return;
    moveFin.mutate(
      { caseId: id, stageId: stage.id },
      {
        onSuccess: () => toast.success(`Financeiro movido pra ${stage.label}`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Falha ao mover o financeiro"),
      },
    );
  }

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
      <Breadcrumb
        items={[
          { label: "Casos", to: "/casos" },
          { label: "Financeiro", to: "/casos/financeiro" },
          { label: serviceType.name },
        ]}
      />
      <PageHeader
        eyebrow="Esteira Financeira"
        title={serviceType.name}
        subtitle={
          isLoading || stagesLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} bifurcado${total === 1 ? "" : "s"}${
                naoBifurcados > 0 ? ` · ${naoBifurcados} ainda não bifurcado(s)` : ""
              }`
        }
        aside={
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={() => setEditorOpen(true)}>
              <Settings2 size={14} />
              Editar etapas
            </Btn>
            <Btn variant="ghost" onClick={onBack}>
              <ArrowLeft size={14} />
              Trocar tipo
            </Btn>
            <Link to="/casos/financeiro/inadimplencia">
              <Btn variant="outline">Inadimplência</Btn>
            </Link>
          </div>
        }
      />

      <StageEditor
        serviceTypeId={serviceType.id}
        serviceTypeName={serviceType.name}
        kind="fin"
        open={editorOpen}
        onOpenChange={setEditorOpen}
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
            placeholder="Buscar por código ou nome do cliente…"
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

      {!stagesLoading && columns.length === 0 ? (
        <Alert>
          <AlertDescription>
            Este tipo ainda não tem etapas financeiras cadastradas.
          </AlertDescription>
        </Alert>
      ) : (
        <KanbanBoard
          columns={columns}
          items={filtered}
          isLoading={isLoading || stagesLoading}
          getId={(c) => c.id}
          getColumn={(c) => c.macrostatus_fin}
          renderCard={(c) => <CaseCardFin caso={c} />}
          onMove={handleMove}
        />
      )}
    </div>
  );
}

/* ───── Kanban financeiro consolidado (TODOS os tipos de serviço) ───── */

const ALL_FIN_COLUMNS: KanbanColumn<string>[] = (
  Object.entries(MACRO_FIN_LABELS) as [MacroFin, string][]
)
  .filter(([slug]) => slug !== "NAO_APLICAVEL")
  .map(([slug, label]) => ({
    id: slug,
    label,
    toneColor:
      slug === "QUITADO" ? "var(--success)" :
      slug === "INADIMPLENTE" ? "var(--danger)" :
      slug === "CANCELADO" ? "var(--muted-foreground)" :
      slug === "SUSPENSO" ? "var(--muted-foreground)" :
      "var(--navy)",
  }));

function FinanceiroKanbanTodos({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const { data: allCases, isLoading, isError, error } = useAllBifurcatedCases();

  const filtered = useMemo(() => {
    const cases = allCases ?? [];
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(
      (c) =>
        c.case_code.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q),
    );
  }, [allCases, search]);

  const total = (allCases ?? []).length;

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
      <Breadcrumb
        items={[
          { label: "Casos", to: "/casos" },
          { label: "Financeiro", to: "/casos/financeiro" },
          { label: "Todos" },
        ]}
      />
      <PageHeader
        eyebrow="Esteira Financeira"
        title="Todos os Casos"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} na esteira financeira`
        }
        aside={
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={onBack}>
              <ArrowLeft size={14} />
              Trocar tipo
            </Btn>
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
            placeholder="Buscar por código ou nome do cliente…"
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
        columns={ALL_FIN_COLUMNS}
        items={filtered}
        isLoading={isLoading}
        getId={(c) => c.id}
        getColumn={(c) => c.macrostatus_fin}
        renderCard={(c) => <CaseCardFin caso={c} />}
      />
    </div>
  );
}
