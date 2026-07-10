import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckSquare, AlertCircle, ChevronRight, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkItems, useAllDeadlines } from "@/hooks/useDossie";
import { useUsers } from "@/hooks/useUsers";

export const Route = createFileRoute("/tarefas")({
  component: TarefasPage,
});

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const today = new Date();
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const PRIO_TONE: Record<string, string> = {
  URGENTE: "var(--danger)",
  ALTA: "var(--warning)",
  MEDIA: "var(--ink-500)",
  BAIXA: "var(--ink-400)",
};
const PRIO_LABEL: Record<string, string> = {
  URGENTE: "Urgente",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};
const PRIO_ORDER: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };

function TarefasPage() {
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const workQ = useWorkItems({
    assigneeId: assigneeId || null,
    status: status || null,
    search: search || null,
  });
  const prazosQ = useAllDeadlines();
  const canSeeAll = workQ.data?.canSeeAll ?? false;
  const { data: users } = useUsers();
  const loading = workQ.isLoading || prazosQ.isLoading;

  const items = workQ.data?.items ?? [];
  const itemsOrdenados = [...items].sort((a, b) => {
    // tarefas por prioridade primeiro; checklist depois.
    const pa = a.type === "tarefa" ? (PRIO_ORDER[a.priority ?? "MEDIA"] ?? 9) : 9;
    const pb = b.type === "tarefa" ? (PRIO_ORDER[b.priority ?? "MEDIA"] ?? 9) : 9;
    return pa - pb;
  });

  const prazos = (prazosQ.data ?? []).filter((d) => d.status === "ABERTO");
  const prazosCriticos = prazos.filter((d) => daysUntil(d.fatal_date) <= 7).length;
  const prazosVencidos = prazos.filter((d) => daysUntil(d.fatal_date) < 0).length;

  const selCls =
    "h-9 rounded-md border border-[var(--border)] bg-white px-2.5 text-[13px] text-[var(--navy)] focus:outline-none focus:border-[var(--gold)]";

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Tarefas" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Tarefas e prazos"
        subtitle={
          canSeeAll
            ? "Tudo que está atribuído aos colaboradores (tarefas + checklist) e os prazos."
            : "Tudo que está atribuído a você (tarefas + checklist) e os prazos dos seus casos."
        }
      />

      {/* KPIs reais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Itens abertos" value={items.length} icon={CheckSquare} loading={loading} />
        <Kpi label="Prazos abertos" value={prazos.length} icon={CalendarClock} loading={loading} />
        <Kpi
          label="Prazos ≤ 7 dias"
          value={prazosCriticos}
          icon={AlertCircle}
          loading={loading}
          danger={prazosCriticos > 0}
        />
        <Kpi
          label="Prazos vencidos"
          value={prazosVencidos}
          icon={AlertCircle}
          loading={loading}
          danger={prazosVencidos > 0}
          featured
        />
      </div>

      {/* Filtros — colaborador só para quem vê tudo (admin/back-office). */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, caso ou cliente…"
          className={`${selCls} min-w-[240px] flex-1`}
        />
        {canSeeAll && (
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className={selCls}
          >
            <option value="">Todos os colaboradores</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Tarefas + Checklist (itens de trabalho) */}
        <div>
          <SectionHead title="Tarefas e checklist" count={items.length} />
          <div className="card-editorial !p-0 overflow-hidden">
            {loading ? (
              <ListSkeleton />
            ) : itemsOrdenados.length === 0 ? (
              <Empty>Nada atribuído com os filtros atuais.</Empty>
            ) : (
              itemsOrdenados.map((it, i) => {
                const isTask = it.type === "tarefa";
                const trailing = isTask
                  ? (PRIO_LABEL[it.priority ?? "MEDIA"] ?? it.priority ?? "—")
                  : "Checklist";
                const trailingColor = isTask
                  ? (PRIO_TONE[it.priority ?? "MEDIA"] ?? "var(--ink-500)")
                  : "var(--gold-700)";
                const who = it.assignee_name ? ` · ${it.assignee_name}` : "";
                return (
                  <Row
                    key={`${it.type}:${it.id}`}
                    caseId={it.case_id}
                    icon={isTask ? CheckSquare : ListChecks}
                    primary={it.title}
                    secondary={`${it.client_name} · ${it.case_code}${who}`}
                    trailing={trailing}
                    trailingColor={trailingColor}
                    last={i === itemsOrdenados.length - 1}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Prazos */}
        <div>
          <SectionHead title="Prazos" count={prazos.length} />
          <div className="card-editorial !p-0 overflow-hidden">
            {loading ? (
              <ListSkeleton />
            ) : prazos.length === 0 ? (
              <Empty>Nenhum prazo aberto.</Empty>
            ) : (
              prazos.map((d, i) => {
                const dias = daysUntil(d.fatal_date);
                const tone =
                  dias < 0 ? "var(--danger)" : dias <= 7 ? "var(--warning)" : "var(--success)";
                return (
                  <Row
                    key={d.id}
                    caseId={d.case_id}
                    primary={d.title}
                    secondary={`${d.client_name} · ${d.case_code}${d.tipo ? ` · ${d.tipo}` : ""}`}
                    trailing={dias < 0 ? `${Math.abs(dias)}d atraso` : `${dias}d`}
                    trailingColor={tone}
                    last={i === prazos.length - 1}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  loading,
  danger,
  featured,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  loading?: boolean;
  danger?: boolean;
  featured?: boolean;
}) {
  return (
    <div
      className="card-editorial !p-5"
      style={featured ? { borderColor: "rgba(152,120,20,0.28)" } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">{label}</span>
        <Icon size={15} style={{ color: featured ? "#987814" : "var(--ink-400)" }} />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-12 rounded" />
      ) : (
        <div
          className="kpi-number"
          style={{
            color: danger ? "var(--danger)" : featured ? "var(--gold-700)" : "#1e2044",
            fontSize: 30,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function Row({
  caseId,
  primary,
  secondary,
  trailing,
  trailingColor,
  last,
  icon: Icon,
}: {
  caseId: string;
  primary: string;
  secondary: string;
  trailing: string;
  trailingColor: string;
  last: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Link
      to="/casos/$id"
      params={{ id: caseId }}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ink-50)]"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      {Icon && <Icon size={15} className="text-[var(--ink-400)] shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">{primary}</div>
        <div className="text-[11.5px] text-muted-foreground truncate">{secondary}</div>
      </div>
      <div className="text-[12px] tabular font-semibold shrink-0" style={{ color: trailingColor }}>
        {trailing}
      </div>
      <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
    </Link>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-3.5">
      <h2 className="text-[15px] font-semibold text-[var(--navy)]">{title}</h2>
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-100)] text-[var(--ink-700)]">
        {count}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">{children}</div>;
}

function ListSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}
