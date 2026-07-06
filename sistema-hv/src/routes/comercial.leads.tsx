import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, LayoutGrid, List, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { StageEditor } from "@/components/cases/StageEditor";
import { LeadCard } from "@/components/comercial/LeadCard";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Badge, Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useComercialBoard, useMoveCaseStageComercial, useStages } from "@/hooks/usePipeline";
import {
  CASE_TYPE_LABELS,
  GLOBAL_FUNNEL_SERVICE_TYPE_ID,
  type CaseType,
} from "@/lib/cases/constants";
import { useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/comercial/leads")({
  component: LeadsPage,
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

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// #15 — Comercial = UM funil ÚNICO editável. As etapas vêm do conjunto global
// (tipo sentinela) e o board mostra casos comerciais de TODOS os tipos + cadastros
// novos (leads sintéticos na coluna Novo). Sem seleção por tipo.
function LeadsPage() {
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const { data: stages, isLoading: stagesLoading } = useStages(
    GLOBAL_FUNNEL_SERVICE_TYPE_ID,
    "comercial",
  );
  const { data: items, isLoading, isError, error } = useComercialBoard();
  const move = useMoveCaseStageComercial(GLOBAL_FUNNEL_SERVICE_TYPE_ID);
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");
  const [editorOpen, setEditorOpen] = useState(false);

  useDocumentTitle("Comercial");

  const rows = items ?? [];

  // S9-08 / S9-12 — a etapa terminal comercial (stage_role='won', slug 'GANHO') é
  // exibida como "Contrato e procuração assinado" no modelo COMBINADO. Preferimos
  // o `label` da etapa (editável no funil); se ainda for o default "Ganho"/"GANHO",
  // aplicamos o rótulo do modelo. NUNCA alteramos o slug (gatilhos S9-03/S9-05
  // dependem dele).
  const displayStageLabel = (stage: {
    slug: string;
    label: string;
    stage_role: string;
  }): string => {
    if (stage.stage_role === "won") {
      const isDefault =
        ["ganho", "GANHO"].includes(stage.label.trim().toLowerCase()) ||
        stage.label.trim().toUpperCase() === "GANHO";
      return isDefault ? "Contrato e procuração assinado" : stage.label;
    }
    return stage.label;
  };

  const columns: KanbanColumn<string>[] = (stages ?? []).map((s) => ({
    id: s.slug,
    label: displayStageLabel(s),
    toneColor: roleColor(s.stage_role),
  }));

  const stageLabel = (slug: string | null): string => {
    const s = (stages ?? []).find((st) => st.slug === slug);
    return s ? displayStageLabel(s) : "—";
  };

  function handleMove(id: string, toSlug: string) {
    const row = rows.find((r) => r.id === id);
    // Cadastros sintéticos (sem caso) não movem pelo Kanban — abra a ficha para
    // iniciar o fluxo comercial (procuração). Silencioso: apenas ignora o drop.
    if (row?.is_registration) {
      toast.info("Abra o cadastro para iniciar o fluxo comercial deste lead.");
      return;
    }
    const stage = (stages ?? []).find((s) => s.slug === toSlug);
    if (!stage) return;
    move.mutate(
      { caseId: id, stageId: stage.id },
      {
        onSuccess: () => toast.success(`Movido pra ${displayStageLabel(stage)}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao mover"),
      },
    );
  }

  const total = rows.length;

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
      <Breadcrumb items={[{ label: "Inteligência", to: "/comercial" }, { label: "Comercial" }]} />
      <PageHeader
        eyebrow="Pipeline comercial"
        title="Comercial"
        subtitle={
          isLoading || stagesLoading
            ? "Carregando…"
            : `${total} lead${total === 1 ? "" : "s"} no funil em ${columns.length} etapas.`
        }
        aside={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
              {(["kanban", "lista"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={
                    view === v
                      ? "px-3 py-1.5 bg-[var(--navy)] text-white inline-flex items-center gap-1.5"
                      : "px-3 py-1.5 text-muted-foreground hover:bg-[var(--muted)] inline-flex items-center gap-1.5"
                  }
                >
                  {v === "kanban" ? <LayoutGrid size={13} /> : <List size={13} />}
                  {v === "kanban" ? "Pipeline" : "Lista"}
                </button>
              ))}
            </div>
            {canEditStages && (
              <Btn variant="ghost" onClick={() => setEditorOpen(true)}>
                <Settings2 size={14} />
                Editar etapas
              </Btn>
            )}
          </div>
        }
      />

      {/* #15 — edita o conjunto ÚNICO de etapas comerciais (tipo sentinela) */}
      <StageEditor
        serviceTypeId={GLOBAL_FUNNEL_SERVICE_TYPE_ID}
        serviceTypeName="Funil comercial"
        kind="comercial"
        open={editorOpen}
        onOpenChange={setEditorOpen}
        canEdit={canEditStages}
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar leads: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {!stagesLoading && columns.length === 0 ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Layers size={15} /> O funil comercial ainda não tem etapas cadastradas.
          </AlertDescription>
        </Alert>
      ) : view === "kanban" ? (
        <KanbanBoard
          columns={columns}
          items={rows}
          isLoading={isLoading || stagesLoading}
          getId={(c) => c.id}
          getColumn={(c) => c.macrostatus_comercial ?? "NOVO"}
          renderCard={(c) => <LeadCard lead={c} />}
          onMove={handleMove}
        />
      ) : (
        <LeadsList leads={rows} isLoading={isLoading || stagesLoading} stageLabel={stageLabel} />
      )}
    </div>
  );
}

type LeadRow = {
  id: string;
  client_id: string;
  case_code: string;
  case_type: string;
  macrostatus_comercial: string | null;
  created_at: string;
  client_name: string;
  is_registration: boolean;
};

function LeadsList({
  leads,
  isLoading,
  stageLabel,
}: {
  leads: LeadRow[];
  isLoading: boolean;
  stageLabel: (slug: string | null) => string;
}) {
  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Carregando…</div>;
  }
  if (leads.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Nenhum lead no comercial ainda. Todo cadastro novo entra aqui automaticamente.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-semibold">Cliente</th>
            <th className="px-4 py-2.5 font-semibold">Código</th>
            <th className="px-4 py-2.5 font-semibold">Tipo</th>
            <th className="px-4 py-2.5 font-semibold">Etapa</th>
            <th className="px-4 py-2.5 font-semibold text-right">Dias parado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors"
            >
              <td className="px-4 py-2.5">
                {l.is_registration ? (
                  <Link
                    to="/clientes/$id"
                    params={{ id: l.client_id }}
                    className="font-medium text-[var(--navy)] hover:text-[var(--gold-700)] transition-colors"
                  >
                    {l.client_name}
                  </Link>
                ) : (
                  <Link
                    to="/casos/$id"
                    params={{ id: l.id }}
                    className="font-medium text-[var(--navy)] hover:text-[var(--gold-700)] transition-colors"
                  >
                    {l.client_name}
                  </Link>
                )}
              </td>
              <td className="px-4 py-2.5 tabular text-[var(--ink-500)]">{l.case_code}</td>
              <td className="px-4 py-2.5">
                {l.is_registration ? (
                  <Badge tone="navy">Novo cadastro</Badge>
                ) : (
                  <Badge tone="gold">
                    {CASE_TYPE_LABELS[l.case_type as CaseType] ?? l.case_type}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2.5">{stageLabel(l.macrostatus_comercial)}</td>
              <td className="px-4 py-2.5 text-right tabular">{daysSince(l.created_at)}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
