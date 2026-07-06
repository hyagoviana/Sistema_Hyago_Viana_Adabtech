import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban, Layers, LayoutGrid, List, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { StageEditor } from "@/components/cases/StageEditor";
import { LeadCard } from "@/components/comercial/LeadCard";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Badge, Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useLeadsByServiceType,
  useMoveCaseStageComercial,
  useServiceTypes,
  useStages,
} from "@/hooks/usePipeline";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";

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

function LeadsPage() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  if (selected) {
    return <LeadsKanban serviceType={selected} onBack={() => setSelected(null)} />;
  }
  return <ServiceTypeSelection onPick={setSelected} />;
}

function ServiceTypeSelection({ onPick }: { onPick: (t: { id: string; name: string }) => void }) {
  const { data: types, isLoading } = useServiceTypes();
  useDocumentTitle("Comercial");

  return (
    <div className="page-container !pb-10">
      <Breadcrumb
        items={[{ label: "Inteligência", to: "/comercial" }, { label: "Comercial" }]}
      />
      <PageHeader
        eyebrow="Inteligência"
        title="Comercial"
        subtitle="Escolha o tipo de serviço para abrir a pipeline comercial."
      />

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando…</div>
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
                  <div className="text-[15px] font-semibold text-[var(--navy)]">{t.name}</div>
                  <div className="text-[12px] text-muted-foreground">Abrir pipeline comercial →</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadsKanban({
  serviceType,
  onBack,
}: {
  serviceType: { id: string; name: string };
  onBack: () => void;
}) {
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, "comercial");
  const { data: leads, isLoading, isError, error } = useLeadsByServiceType(serviceType.id);
  const move = useMoveCaseStageComercial(serviceType.id);
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");
  const [editorOpen, setEditorOpen] = useState(false);

  useDocumentTitle(
    resolveEntityLabel(serviceType.name, {
      loading: false,
      notFoundLabel: "Comercial",
    }),
  );

  const items = leads ?? [];

  // S9-08 / S9-12 — a etapa terminal comercial (stage_role='won', slug 'GANHO') é
  // exibida como "Contrato e procuração assinado" no modelo COMBINADO. Preferimos
  // o `label` da etapa (editável no funil); se ainda for o default "Ganho"/"GANHO",
  // aplicamos o rótulo do modelo. NUNCA alteramos o slug (gatilhos S9-03/S9-05
  // dependem dele).
  const displayStageLabel = (stage: { slug: string; label: string; stage_role: string }): string => {
    if (stage.stage_role === "won") {
      const isDefault = ["ganho", "GANHO"].includes(stage.label.trim().toLowerCase())
        || stage.label.trim().toUpperCase() === "GANHO";
      return isDefault ? "Contrato e procuração assinado" : stage.label;
    }
    return stage.label;
  };

  const columns: KanbanColumn<string>[] = (stages ?? []).map((s) => ({
    id: s.slug,
    label: displayStageLabel(s),
    toneColor: roleColor(s.stage_role),
  }));

  // Rótulo da etapa comercial atual (para a lista).
  const stageLabel = (slug: string | null): string => {
    const s = (stages ?? []).find((st) => st.slug === slug);
    return s ? displayStageLabel(s) : "—";
  };

  function handleMove(id: string, toSlug: string) {
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

  const total = items.length;

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
      <Breadcrumb
        items={[
          { label: "Inteligência", to: "/comercial" },
          { label: "Comercial", to: "/comercial/leads" },
          { label: serviceType.name },
        ]}
      />
      <PageHeader
        eyebrow="Pipeline comercial"
        title={serviceType.name}
        subtitle={
          isLoading || stagesLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} no comercial em ${columns.length} etapas.`
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
            <Layers size={15} /> Este tipo ainda não tem etapas comerciais cadastradas.
          </AlertDescription>
        </Alert>
      ) : view === "kanban" ? (
        <KanbanBoard
          columns={columns}
          items={items}
          isLoading={isLoading || stagesLoading}
          getId={(c) => c.id}
          getColumn={(c) => c.macrostatus_comercial ?? ""}
          renderCard={(c) => <LeadCard lead={c} />}
          onMove={handleMove}
        />
      ) : (
        <LeadsList leads={items} isLoading={isLoading || stagesLoading} stageLabel={stageLabel} />
      )}
    </div>
  );
}

type LeadRow = {
  id: string;
  case_code: string;
  case_type: string;
  macrostatus_comercial: string | null;
  created_at: string;
  client_name: string;
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
          Nenhum caso no comercial ainda. Casos entram aqui quando o contrato e procuração é
          enviado para assinatura.
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
                <Link
                  to="/casos/$id"
                  params={{ id: l.id }}
                  className="font-medium text-[var(--navy)] hover:text-[var(--gold-700)] transition-colors"
                >
                  {l.client_name}
                </Link>
              </td>
              <td className="px-4 py-2.5 tabular text-[var(--ink-500)]">{l.case_code}</td>
              <td className="px-4 py-2.5">
                <Badge tone="gold">
                  {CASE_TYPE_LABELS[l.case_type as CaseType] ?? l.case_type}
                </Badge>
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
