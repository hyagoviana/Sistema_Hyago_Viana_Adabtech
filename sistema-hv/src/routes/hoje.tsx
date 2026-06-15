import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Briefcase,
  DollarSign,
  AlertCircle,
  Clock,
  ChevronRight,
  Users,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/hv/primitives";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CASE_TYPE_LABELS, MACRO_OP_LABELS } from "@/lib/cases/constants";
import type { CaseType, MacroOp } from "@/lib/cases/constants";
import { useCasesList } from "@/hooks/useCases";
import { useClientsList } from "@/hooks/useClients";
import { useAllTasks, useAllDeadlines } from "@/hooks/useDossie";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/hoje")({
  component: HojePage,
});

const NAVY = "#1e2044";
const GOLD = "#987814";

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function HojePage() {
  const { session } = useAuth();
  const { data: casos, isLoading } = useCasesList();
  const { data: clientes, isLoading: isLoadingClients } = useClientsList();
  const { data: tasks } = useAllTasks();
  const { data: deadlines } = useAllDeadlines();

  const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const nome = meta?.full_name || meta?.name || "";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const lista = useMemo(() => casos ?? [], [casos]);
  const totalAtivos = lista.length;
  const totalClientes = (clientes ?? []).length;
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

  // Casos por tipo
  const casosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of lista) {
      map[c.case_type] = (map[c.case_type] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([tipo, qtd]) => ({
        tipo,
        label: CASE_TYPE_LABELS[tipo as CaseType] ?? tipo,
        qtd,
      }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [lista]);

  // Casos por status operacional (top 5)
  const casosPorStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of lista) {
      map[c.macrostatus_op] = (map[c.macrostatus_op] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([status, qtd]) => ({
        status,
        label: MACRO_OP_LABELS[status as MacroOp] ?? status,
        qtd,
      }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 6);
  }, [lista]);

  // Últimos 5 casos criados
  const casosRecentes = useMemo(
    () =>
      [...lista]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [lista],
  );

  // Últimos 5 clientes criados
  const clientesRecentes = useMemo(
    () =>
      [...(clientes ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [clientes],
  );

  const userId = session?.user?.id;

  const minhasTarefas = useMemo(
    () =>
      (tasks ?? []).filter(
        (t) => t.status !== "CONCLUIDA" && (t.assignee_id === userId || !t.assignee_id),
      ),
    [tasks, userId],
  );

  const urgentes = useMemo(
    () =>
      minhasTarefas
        .filter((t) => t.priority === "URGENTE" || t.priority === "ALTA")
        .slice(0, 3),
    [minhasTarefas],
  );

  const proximosPrazos = useMemo(
    () =>
      (deadlines ?? [])
        .filter((d) => d.status === "ABERTO" && daysUntil(d.fatal_date) <= 7)
        .sort((a, b) => new Date(a.fatal_date).getTime() - new Date(b.fatal_date).getTime())
        .slice(0, 6),
    [deadlines],
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

      {/* KPIs — clicáveis */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Kpi
          label="Casos ativos"
          value={totalAtivos}
          icon={Briefcase}
          loading={isLoading}
          to="/pipeline"
        />
        <Kpi
          label="Clientes"
          value={totalClientes}
          icon={Users}
          loading={isLoadingClients}
          to="/clientes"
        />
        <Kpi
          label="Na pipeline financeira"
          value={bifurcados}
          icon={DollarSign}
          loading={isLoading}
          to="/casos/financeiro"
        />
        <Kpi
          label="Inadimplentes"
          value={inadimplentes}
          icon={AlertCircle}
          loading={isLoading}
          danger={inadimplentes > 0}
          to="/casos/financeiro"
        />
        <Kpi
          label="Parados > 30 dias"
          value={parados.length}
          icon={Clock}
          loading={isLoading}
          danger={parados.length > 0}
          featured
          to="/pipeline"
        />
      </div>

      {/* Distribuição: por tipo + por status operacional */}
      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <div>
          <SectionHead title="Casos por tipo" count={casosPorTipo.length} to="/pipeline" cta="Ver pipeline" />
          <div className="card-editorial !p-0 overflow-hidden">
            {isLoading ? (
              <ListSkeleton />
            ) : casosPorTipo.length === 0 ? (
              <Empty>Nenhum caso cadastrado.</Empty>
            ) : (
              casosPorTipo.map((t, i) => (
                <div
                  key={t.tipo}
                  className="flex items-center justify-between px-4 py-3"
                  style={i < casosPorTipo.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    <Scale size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-[13.5px] font-medium text-[var(--navy)]">{t.label}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold text-[12px]">
                    {t.qtd}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <SectionHead title="Status operacional" count={casosPorStatus.length} to="/pipeline" cta="Ver pipeline" />
          <div className="card-editorial !p-0 overflow-hidden">
            {isLoading ? (
              <ListSkeleton />
            ) : casosPorStatus.length === 0 ? (
              <Empty>Nenhum caso cadastrado.</Empty>
            ) : (
              casosPorStatus.map((s, i) => (
                <div
                  key={s.status}
                  className="flex items-center justify-between px-4 py-3"
                  style={i < casosPorStatus.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <span className="text-[13.5px] text-[var(--navy)]">{s.label}</span>
                  <Badge variant="outline" className="font-semibold text-[12px]">
                    {s.qtd}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Urgente — tarefas reais */}
      <SectionHead title="Urgente" count={urgentes.length} to="/tarefas" cta="Ver tarefas" />
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {urgentes.length === 0 ? (
          <div className="card-editorial !p-6 text-center text-[13px] text-muted-foreground md:col-span-3">
            Nenhuma tarefa urgente em aberto.
          </div>
        ) : (
          urgentes.map((t) => (
            <Link
              key={t.id}
              to="/casos/$id"
              params={{ id: t.case_id }}
              className="card-editorial !p-4 block"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  size={15}
                  className="mt-0.5 shrink-0"
                  style={{ color: t.priority === "URGENTE" ? "var(--danger)" : "var(--warning)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--navy)] leading-snug">
                    {t.title}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
                    {t.client_name} · {t.case_code}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* 2x2: Próximos 7 dias + Sem movimentação + Casos recentes + Clientes recentes */}
      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        {/* Próximos 7 dias — prazos reais */}
        <div>
          <SectionHead title="Próximos 7 dias" count={proximosPrazos.length} to="/tarefas" cta="Agenda" />
          <div className="card-editorial !p-0 overflow-hidden">
            {proximosPrazos.length === 0 ? (
              <Empty>Nenhum prazo nos próximos 7 dias.</Empty>
            ) : (
              proximosPrazos.map((d, i) => {
                const dias = daysUntil(d.fatal_date);
                return (
                  <Row
                    key={d.id}
                    caseId={d.case_id}
                    primary={d.title}
                    secondary={`${d.client_name} · ${d.case_code}`}
                    trailing={dias < 0 ? `${Math.abs(dias)}d atraso` : `${dias}d`}
                    trailingColor={dias < 0 ? "var(--danger)" : "var(--warning)"}
                    last={i === proximosPrazos.length - 1}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Sem movimentação — casos reais */}
        <div>
          <SectionHead title="Sem movimentação > 30 dias" count={parados.length} to="/pipeline" cta="Ver pipeline" />
          <div className="card-editorial !p-0 overflow-hidden">
            {isLoading ? (
              <ListSkeleton />
            ) : parados.length === 0 ? (
              <Empty>Nenhum caso parado há mais de 30 dias.</Empty>
            ) : (
              parados.map((c, i) => (
                <Row
                  key={c.id}
                  caseId={c.id}
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
      </div>

      {/* Recentes: casos e clientes */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <SectionHead title="Casos recentes" count={casosRecentes.length} to="/pipeline" cta="Ver todos" />
          <div className="card-editorial !p-0 overflow-hidden">
            {isLoading ? (
              <ListSkeleton />
            ) : casosRecentes.length === 0 ? (
              <Empty>Nenhum caso ainda.</Empty>
            ) : (
              casosRecentes.map((c, i) => (
                <Link
                  key={c.id}
                  to="/casos/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ink-50)]"
                  style={i < casosRecentes.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">
                      {c.case_code}
                      <span className="text-muted-foreground font-normal"> · {c.client_name}</span>
                    </div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type} · {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                    </div>
                  </div>
                  <div className="text-[12px] text-muted-foreground shrink-0 tabular">
                    {formatDate(c.created_at)}
                  </div>
                  <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <SectionHead title="Clientes recentes" count={clientesRecentes.length} to="/clientes" cta="Ver todos" />
          <div className="card-editorial !p-0 overflow-hidden">
            {isLoadingClients ? (
              <ListSkeleton />
            ) : clientesRecentes.length === 0 ? (
              <Empty>Nenhum cliente ainda.</Empty>
            ) : (
              clientesRecentes.map((c, i) => (
                <Link
                  key={c.id}
                  to="/clientes/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ink-50)]"
                  style={i < clientesRecentes.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">
                      {c.full_name}
                    </div>
                    {c.cpf_cnpj && (
                      <div className="text-[11.5px] text-muted-foreground mt-0.5 font-mono">
                        {c.cpf_cnpj}
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] text-muted-foreground shrink-0 tabular">
                    {formatDate(c.created_at)}
                  </div>
                  <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
                </Link>
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
  to,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  loading?: boolean;
  danger?: boolean;
  featured?: boolean;
  to?: string;
}) {
  const chipBg = danger ? "rgba(180,36,50,0.08)" : "var(--gold-pale)";
  const chipColor = danger ? "var(--danger)" : GOLD;

  const content = (
    <div
      className="card-editorial !p-5 group"
      style={featured ? { borderColor: "rgba(152,120,20,0.28)" } : undefined}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--gold-700)" }}
        >
          {label}
        </span>
        <span
          className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
          style={{ background: chipBg }}
        >
          <Icon size={14} strokeWidth={1.8} style={{ color: chipColor }} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16 rounded" />
      ) : (
        <div
          className="kpi-number"
          style={{
            color: danger ? "var(--danger)" : featured ? "var(--gold-700)" : NAVY,
            fontSize: 36,
            fontWeight: 700,
          }}
        >
          {value}
        </div>
      )}
      {to && (
        <div className="mt-2 text-[11px] text-muted-foreground group-hover:text-[var(--gold-700)] transition-colors flex items-center gap-1">
          Ver detalhes <ChevronRight size={10} />
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to as any} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

function Row({
  caseId,
  primary,
  secondary,
  trailing,
  trailingColor,
  last,
}: {
  caseId: string;
  primary: string;
  secondary: string;
  trailing: string;
  trailingColor: string;
  last: boolean;
}) {
  return (
    <Link
      to="/casos/$id"
      params={{ id: caseId }}
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
        <h2 className="text-[15px] font-semibold text-[var(--navy)]">{title}</h2>
        {count !== undefined && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-100)] text-[var(--ink-700)]">
            {count}
          </span>
        )}
      </div>
      {to && cta && (
        <Link
          to={to as any}
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
