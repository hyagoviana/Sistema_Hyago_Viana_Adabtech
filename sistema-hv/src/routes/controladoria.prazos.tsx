import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, AlertTriangle, ChevronRight, CheckCircle2, Search, Filter } from "lucide-react";
import { useMemo, useState } from "react";

import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllDeadlines, useSetCaseDeadlineStatus } from "@/hooks/useDossie";

export const Route = createFileRoute("/controladoria/prazos")({
  component: PrazosPage,
});

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "·";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type StatusFilter = "todos" | "vencidos" | "criticos" | "ok";

function PrazosPage() {
  const { data, isLoading } = useAllDeadlines();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [respFilter, setRespFilter] = useState("");

  const prazos = useMemo(() => {
    return (data ?? []).filter((d) => d.status === "ABERTO");
  }, [data]);

  const responsaveis = useMemo(() => {
    return Array.from(new Set(prazos.map((d) => d.responsible).filter(Boolean))).sort() as string[];
  }, [prazos]);

  const filtered = useMemo(() => {
    let result = prazos;

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(s) ||
          d.case_code.toLowerCase().includes(s) ||
          d.client_name.toLowerCase().includes(s) ||
          (d.responsible?.toLowerCase().includes(s) ?? false),
      );
    }

    if (statusFilter === "vencidos") {
      result = result.filter((d) => daysUntil(d.fatal_date) < 0);
    } else if (statusFilter === "criticos") {
      result = result.filter((d) => {
        const x = daysUntil(d.fatal_date);
        return x >= 0 && x <= 7;
      });
    } else if (statusFilter === "ok") {
      result = result.filter((d) => daysUntil(d.fatal_date) > 7);
    }

    if (respFilter) {
      result =
        respFilter === "__sem"
          ? result.filter((d) => !d.responsible || d.responsible.trim() === "")
          : result.filter((d) => d.responsible === respFilter);
    }

    return result.sort(
      (a, b) => new Date(a.fatal_date).getTime() - new Date(b.fatal_date).getTime(),
    );
  }, [prazos, search, statusFilter, respFilter]);

  const vencidos = prazos.filter((d) => daysUntil(d.fatal_date) < 0).length;
  const criticos = prazos.filter((d) => {
    const x = daysUntil(d.fatal_date);
    return x >= 0 && x <= 7;
  }).length;

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Controladoria", to: "/controladoria" },
          { label: "Prazos" },
        ]}
      />
      <PageHeader
        eyebrow="Controladoria"
        title="Gestão de Prazos"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${prazos.length} prazo${prazos.length !== 1 ? "s" : ""} em aberto.`
        }
      />

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card-editorial !p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">
                Total abertos
              </span>
              <CalendarClock size={15} className="text-[var(--ink-400)]" />
            </div>
            <div className="kpi-number" style={{ fontSize: 30, color: "var(--gold-700)" }}>
              {prazos.length}
            </div>
          </div>
          <div
            className="card-editorial !p-5"
            style={vencidos > 0 ? { borderColor: "rgba(180,36,50,0.22)" } : undefined}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">
                Vencidos
              </span>
              <AlertTriangle size={15} style={{ color: vencidos > 0 ? "var(--danger)" : "var(--ink-400)" }} />
            </div>
            <div
              className="kpi-number"
              style={{ fontSize: 30, color: vencidos > 0 ? "var(--danger)" : "var(--ink-500)" }}
            >
              {vencidos}
            </div>
          </div>
          <div
            className="card-editorial !p-5"
            style={criticos > 0 ? { borderColor: "rgba(162,90,8,0.18)" } : undefined}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">
                Criticos (≤ 7d)
              </span>
              <AlertTriangle size={15} style={{ color: criticos > 0 ? "var(--warning)" : "var(--ink-400)" }} />
            </div>
            <div
              className="kpi-number"
              style={{ fontSize: 30, color: criticos > 0 ? "var(--warning)" : "var(--ink-500)" }}
            >
              {criticos}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar prazo, caso ou cliente…"
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--ink-500)]">
          <Filter size={13} />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12.5px] focus:border-[var(--gold)] outline-none"
        >
          <option value="todos">Todos</option>
          <option value="vencidos">Vencidos</option>
          <option value="criticos">Críticos (≤ 7d)</option>
          <option value="ok">No prazo</option>
        </select>
        <select
          value={respFilter}
          onChange={(e) => setRespFilter(e.target.value)}
          className="px-3 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12.5px] focus:border-[var(--gold)] outline-none"
        >
          <option value="">Todos responsáveis</option>
          <option value="__sem">Sem responsável</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div className="card-editorial !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--gold-pale)]/40 border-b border-[var(--border)]">
                {["Prazo", "Caso", "Cliente", "Data fatal", "Dias", "Responsável", "Tipo", ""].map(
                  (h) => (
                    <th key={h} className="text-left px-4 py-3.5">
                      <Eyebrow>{h}</Eyebrow>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[rgba(152,120,20,0.08)]">
                    <td colSpan={8} className="px-4 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum prazo encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => <PrazoRow key={d.id} prazo={d} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PrazoRow({
  prazo: d,
}: {
  prazo: {
    id: string;
    case_id: string;
    case_code: string;
    client_name: string;
    title: string;
    fatal_date: string;
    responsible: string | null;
    tipo: string | null;
    status: string;
  };
}) {
  const dias = daysUntil(d.fatal_date);
  const tone = dias < 0 ? "var(--danger)" : dias <= 7 ? "var(--warning)" : "var(--success)";
  const markDone = useSetCaseDeadlineStatus(d.case_id);

  function handleConcluir() {
    if (markDone.isPending) return;
    markDone.mutate({ id: d.id, status: "CONCLUIDO" });
  }

  return (
    <tr className="border-b border-[rgba(152,120,20,0.08)] hover:bg-[var(--bg-subtle)] transition-colors">
      <td className="px-4 py-3">
        <div className="text-[13px] font-medium text-[var(--navy)]">{d.title}</div>
      </td>
      <td className="px-4 py-3">
        <Link
          to="/casos/$id"
          params={{ id: d.case_id }}
          className="font-mono text-[12px] text-[var(--gold-700)] hover:underline"
        >
          {d.case_code}
        </Link>
      </td>
      <td className="px-4 py-3 text-[12.5px] text-[var(--navy)]">{d.client_name}</td>
      <td className="px-4 py-3 font-mono text-[12px]">{fmtDate(d.fatal_date)}</td>
      <td className="px-4 py-3">
        <span className="text-[12px] font-semibold tabular" style={{ color: tone }}>
          {dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? "Hoje" : `${dias}d`}
        </span>
      </td>
      <td className="px-4 py-3 text-[12.5px]">
        {d.responsible || (
          <span className="text-[var(--danger)] text-[12px]">Sem responsável</span>
        )}
      </td>
      <td className="px-4 py-3 text-[12px] text-muted-foreground">{d.tipo ?? "·"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleConcluir}
            disabled={markDone.isPending}
            className="text-[11px] font-medium text-[var(--success)] hover:underline disabled:opacity-50"
            title="Marcar como concluído"
          >
            <CheckCircle2 size={16} />
          </button>
          <Link to="/casos/$id" params={{ id: d.case_id }}>
            <ChevronRight size={14} className="text-[var(--ink-300)]" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
