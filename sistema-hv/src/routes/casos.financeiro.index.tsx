import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, Search, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CaseCardFin } from "@/components/cases/CaseCardFin";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { StageEditor } from "@/components/cases/StageEditor";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GLOBAL_FUNNEL_SERVICE_TYPE_ID } from "@/lib/cases/constants";
import {
  useAllBifurcatedCases,
  useCasesByServiceType,
  useMoveCaseStageFin,
  useStages,
} from "@/hooks/usePipeline";
import { usePodeEditar } from "@/hooks/usePermissions";
import { useTemas } from "@/hooks/useTemas";

// #16 — o financeiro agora abre DIRETO num funil ÚNICO editável. Mantemos o
// parâmetro `type` (deep-link legado) para abrir a esteira de um tipo específico,
// mas a entrada padrão é o board único (sem tela de seleção por tipo).
const searchSchema = z.object({
  type: z.string().uuid().optional().catch(undefined),
  typeName: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/casos/financeiro/")({
  component: CasosFinanceiro,
  validateSearch: (search) => searchSchema.parse(search),
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
  const { type, typeName } = Route.useSearch();
  const navigate = useNavigate();

  const goBack = () => navigate({ to: "/casos/financeiro", search: {} });

  // Deep-link legado por tipo — abre a esteira daquele tipo. Sem `type`, cai no
  // funil único (default).
  if (type) {
    return <FinanceiroKanban serviceType={{ id: type, name: typeName ?? "·" }} onBack={goBack} />;
  }
  return <FinanceiroKanbanTodos />;
}

/* ───── Kanban financeiro filtrado por tipo de serviço (deep-link legado) ───── */

function FinanceiroKanban({
  serviceType,
  onBack,
}: {
  serviceType: { id: string; name: string };
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");

  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, "fin");
  const { data: allCases, isLoading, isError, error } = useCasesByServiceType(serviceType.id);
  const moveFin = useMoveCaseStageFin(serviceType.id);
  const podeEditar = usePodeEditar("financeiro");

  // Só casos bifurcados (macrostatus_fin != NAO_APLICAVEL)
  const bifurcated = useMemo(
    () =>
      (allCases ?? []).filter((c) => c.macrostatus_fin && c.macrostatus_fin !== "NAO_APLICAVEL"),
    [allCases],
  );

  // Filtro de busca local por código ou nome do cliente
  const filtered = useMemo(() => {
    if (!search.trim()) return bifurcated;
    const q = search.toLowerCase();
    return bifurcated.filter(
      (c) => c.case_code.toLowerCase().includes(q) || c.client_name.toLowerCase().includes(q),
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
            <Btn onClick={() => setEditorOpen(true)}>
              <Settings2 size={14} />
              Editar etapas
            </Btn>
            <Btn variant="ghost" onClick={onBack}>
              <ArrowLeft size={14} />
              Trocar tipo
            </Btn>
            <Link to="/casos/financeiro/cobrancas">
              <Btn variant="outline">Cobranças</Btn>
            </Link>
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
        canEdit={canEditStages}
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
          onMove={podeEditar ? handleMove : undefined}
        />
      )}
    </div>
  );
}

/* ───── Kanban financeiro ÚNICO (funil global editável — #16) ───── */

function FinanceiroKanbanTodos() {
  const [search, setSearch] = useState("");
  // T4 (2026-07-19) — filtro por TEMA (não mais por tipo legado), alinhado ao
  // seletor do operacional. "" = todos os temas.
  const [temaFilter, setTemaFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const { data: allCases, isLoading, isError, error } = useAllBifurcatedCases();
  const { data: temas } = useTemas();
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");

  // #16 — as colunas vêm do conjunto ÚNICO global (tipo sentinela), editável no
  // StageEditor. O board mostra casos de TODOS os tipos, mapeados por slug.
  const { data: stages, isLoading: stagesLoading } = useStages(
    GLOBAL_FUNNEL_SERVICE_TYPE_ID,
    "fin",
  );
  const moveFin = useMoveCaseStageFin(GLOBAL_FUNNEL_SERVICE_TYPE_ID);
  const podeEditar = usePodeEditar("financeiro");

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

  const filtered = useMemo(() => {
    let cases = allCases ?? [];
    // Filtro por TEMA (o "guarda-chuva" do caso). "" = todos.
    if (temaFilter) {
      cases = cases.filter((c) => (c as { tema_id?: string | null }).tema_id === temaFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      cases = cases.filter(
        (c) => c.case_code.toLowerCase().includes(q) || c.client_name.toLowerCase().includes(q),
      );
    }
    return cases;
  }, [allCases, search, temaFilter]);

  const total = (allCases ?? []).length;

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
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: "Financeiro" }]} />
      <PageHeader
        eyebrow="Esteira Financeira"
        title="Pipeline Financeira"
        subtitle={
          isLoading || stagesLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} na esteira financeira · ${columns.length} etapas`
        }
        aside={
          <div className="flex items-center gap-2">
            {canEditStages && (
              <Btn onClick={() => setEditorOpen(true)}>
                <Settings2 size={14} />
                Editar etapas
              </Btn>
            )}
            <Link to="/casos">
              <Btn variant="ghost">
                <ArrowLeft size={14} />
                Voltar ao Operacional
              </Btn>
            </Link>
            <Link to="/casos/financeiro/cobrancas">
              <Btn variant="outline">Cobranças</Btn>
            </Link>
            <Link to="/casos/financeiro/inadimplencia">
              <Btn variant="outline">Inadimplência</Btn>
            </Link>
          </div>
        }
      />

      {/* #16 — edita o conjunto ÚNICO de etapas financeiras (tipo sentinela) */}
      <StageEditor
        serviceTypeId={GLOBAL_FUNNEL_SERVICE_TYPE_ID}
        serviceTypeName="Funil financeiro"
        kind="fin"
        open={editorOpen}
        onOpenChange={setEditorOpen}
        canEdit={canEditStages}
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
        {/* Filtro por TEMA — integra com a busca acima. */}
        <select
          value={temaFilter}
          onChange={(e) => setTemaFilter(e.target.value)}
          className="py-2.5 px-3 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
        >
          <option value="">Todos os temas</option>
          {(temas ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
          <AlertDescription>O funil financeiro ainda não tem etapas cadastradas.</AlertDescription>
        </Alert>
      ) : (
        <KanbanBoard
          columns={columns}
          items={filtered}
          isLoading={isLoading || stagesLoading}
          getId={(c) => c.id}
          getColumn={(c) => c.macrostatus_fin}
          renderCard={(c) => <CaseCardFin caso={c} />}
          onMove={podeEditar ? handleMove : undefined}
        />
      )}
    </div>
  );
}
