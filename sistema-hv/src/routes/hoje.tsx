import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, DollarSign, AlertCircle, Clock, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { useAuth } from "@/lib/auth";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";

export const Route = createFileRoute("/hoje")({
  component: HojePage,
});

const NAVY = "#1e2044";
const GOLD = "#987814";

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function HojePage() {
  const { session } = useAuth();
  const { data: casos, isLoading } = useCasesList();
  const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const nome = meta?.full_name || meta?.name || "";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const lista = useMemo(() => casos ?? [], [casos]);

  const totalAtivos = lista.length;
  const bifurcados = lista.filter((c) => c.macrostatus_fin !== "NAO_APLICAVEL").length;
  const inadimplentes = lista.filter(
    (c) => c.macrostatus_fin === "INADIMPLENTE" || c.inadimplente,
  ).length;

  const parados = useMemo(
    () =>
      lista
        .map((c) => ({ ...c, dias: daysSince(c.status_changed_at) }))
        .filter((c) => c.dias > 30)
        .sort((a, b) => b.dias - a.dias)
        .slice(0, 6),
    [lista],
  );

  const recentes = useMemo(
    () =>
      [...lista]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [lista],
  );

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Painel executivo"
        title={nome ? `${saudacao}, ${nome}` : saudacao}
        subtitle={
          isLoading
            ? "Carregando…"
            : `${totalAtivos} ${totalAtivos === 1 ? "caso ativo" : "casos ativos"} no sistema.`
        }
      />

      {/* KPIs — todos derivados de dados reais do Supabase */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi label="Casos ativos" value={totalAtivos} icon={Briefcase} loading={isLoading} />
        <Kpi label="Na pipeline financeira" value={bifurcados} icon={DollarSign} loading={isLoading} />
        <Kpi
          label="Inadimplentes"
          value={inadimplentes}
          icon={AlertCircle}
          loading={isLoading}
          danger={inadimplentes > 0}
        />
        <Kpi
          label="Parados > 30 dias"
          value={parados.length}
          icon={Clock}
          loading={isLoading}
          danger={parados.length > 0}
          featured
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Sem movimentação — real (status_changed_at > 30d) */}
        <div>
          <SectionHead title="Sem movimentação > 30 dias" count={parados.length} />
          <div className="card-editorial !p-0 overflow-hidden">
            {isLoading ? (
              <ListSkeleton />
            ) : parados.length === 0 ? (
              <Empty>Nenhum caso parado há mais de 30 dias. 🎉</Empty>
            ) : (
              parados.map((c, i) => (
                <CaseRow
                  key={c.id}
                  id={c.id}
                  primary={c.client_name}
                  secondary={c.case_code}
                  trailing={`${c.dias}d`}
                  trailingColor={c.dias > 45 ? "var(--danger)" : "var(--warning)"}
                  last={i === parados.length - 1}
                />
              ))
            )}
          </div>
        </div>

        {/* Casos recentes — real (created_at desc) */}
        <div>
          <SectionHead title="Casos recentes" count={recentes.length} to="/casos" cta="Ver pipeline" />
          <div className="card-editorial !p-0 overflow-hidden">
            {isLoading ? (
              <ListSkeleton />
            ) : recentes.length === 0 ? (
              <Empty>Nenhum caso cadastrado ainda.</Empty>
            ) : (
              recentes.map((c, i) => (
                <CaseRow
                  key={c.id}
                  id={c.id}
                  primary={c.client_name}
                  secondary={`${c.case_code} · ${CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}`}
                  trailing={new Date(c.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                  trailingColor="var(--muted-foreground)"
                  last={i === recentes.length - 1}
                />
              ))
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
        <Icon size={15} style={{ color: featured ? GOLD : "var(--ink-400)" }} />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 rounded" />
      ) : (
        <div
          className="kpi-number"
          style={{
            color: danger ? "var(--danger)" : featured ? "var(--gold-700)" : NAVY,
            fontSize: 30,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function CaseRow({
  id,
  primary,
  secondary,
  trailing,
  trailingColor,
  last,
}: {
  id: string;
  primary: string;
  secondary: string;
  trailing: string;
  trailingColor: string;
  last: boolean;
}) {
  return (
    <Link
      to="/casos/$id"
      params={{ id }}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ink-50)]"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">{primary}</div>
        <div className="text-[11.5px] font-mono text-muted-foreground truncate">{secondary}</div>
      </div>
      <div className="text-[12.5px] tabular font-semibold shrink-0" style={{ color: trailingColor }}>
        {trailing}
      </div>
      <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
    </Link>
  );
}

function SectionHead({
  title,
  count,
  to,
  cta,
}: {
  title: string;
  count?: number;
  to?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-[18px] text-[var(--navy)]">{title}</h2>
        {count !== undefined && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-100)] text-[var(--ink-700)]">
            {count}
          </span>
        )}
      </div>
      {to && cta && (
        <Link
          to={to}
          className="text-[12px] text-muted-foreground hover:text-[var(--gold-700)] flex items-center gap-1 transition-colors"
        >
          {cta} <ChevronRight size={12} />
        </Link>
      )}
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
