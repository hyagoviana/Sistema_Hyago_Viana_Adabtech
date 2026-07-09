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
import { useEffect, useMemo, useState } from "react";

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

// Count-up dos números reais dos KPIs (~650ms, ease-out). Respeita reduced-motion.
function useCountUp(target: number, duration = 650): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
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
      minhasTarefas.filter((t) => t.priority === "URGENTE" || t.priority === "ALTA").slice(0, 3),
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

  // Máximo para as barras de "casos por tipo" (cara de gráfico).
  const maxTipo = Math.max(1, ...casosPorTipo.map((t) => t.qtd));

  // Masthead — data por extenso + frase-resumo com dados REAIS (omite zeros).
  const dataExtenso = (() => {
    const s = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();
  const resumo = [
    urgentes.length && {
      n: urgentes.length,
      label: urgentes.length === 1 ? "tarefa urgente" : "tarefas urgentes",
    },
    proximosPrazos.length && {
      n: proximosPrazos.length,
      label:
        proximosPrazos.length === 1 ? "prazo nos próximos 7 dias" : "prazos nos próximos 7 dias",
    },
    bifurcados && { n: bifurcados, label: "casos na pipeline financeira" },
  ].filter(Boolean) as { n: number; label: string }[];

  return (
    <div className="page-container hv-stagger">
      {/* Masthead (fidelidade v3) — eyebrow + saudação com nome real + resumo real */}
      <div
        className="flex items-end justify-between pb-5 mb-6 border-b"
        style={{ borderColor: "var(--hv-line)" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className="h-px w-[22px] shrink-0"
              style={{ background: "linear-gradient(90deg, var(--hv-gold-hi), var(--hv-gold))" }}
            />
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ letterSpacing: "0.26em", color: "var(--hv-gold)" }}
            >
              Painel Executivo
            </span>
          </div>
          <h1
            className="font-display text-[30px]"
            style={{ letterSpacing: "-0.035em", color: "var(--hv-ink-text)" }}
          >
            {saudacao}
            {nome ? (
              <>
                , <span style={{ color: "var(--hv-gold-deep)" }}>{nome}</span>
              </>
            ) : (
              ""
            )}
          </h1>
          <p className="text-[13.5px] text-muted-foreground mt-1.5">
            {isLoading
              ? "Carregando…"
              : resumo.length
                ? resumo.map((r, i) => (
                    <span key={r.label}>
                      {i > 0 && (i === resumo.length - 1 ? " e " : ", ")}
                      <b className="font-semibold" style={{ color: "var(--hv-ink-text)" }}>
                        {r.n}
                      </b>{" "}
                      {r.label}
                    </span>
                  ))
                : `${totalAtivos} ${totalAtivos === 1 ? "caso ativo" : "casos ativos"} no sistema.`}
            {resumo.length ? "." : ""}
          </p>
        </div>
        <div
          className="text-right text-[12px] shrink-0 ml-4"
          style={{ color: "var(--hv-muted-2)" }}
        >
          <b className="block text-[13px] font-semibold" style={{ color: "var(--hv-ink-text)" }}>
            {dataExtenso}
          </b>
          <span className="inline-flex items-center gap-1.5 mt-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--hv-green)", boxShadow: "0 0 0 3px rgba(47,122,80,0.15)" }}
            />
            Atualizado agora
          </span>
        </div>
      </div>

      {/* KPIs — clicáveis */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Kpi
          label="Casos ativos"
          value={totalAtivos}
          icon={Briefcase}
          loading={isLoading}
          hero
          to="/casos/lista"
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
        />
        <Kpi
          label="Parados > 30 dias"
          value={parados.length}
          icon={Clock}
          loading={isLoading}
          danger={parados.length > 0}
          to="/controladoria/excecoes"
        />
      </div>

      {/* Distribuição: por tipo (barras) + por status (donut) — grid 1.15fr .85fr */}
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 mb-4">
        <SectionCard
          title="Casos por tipo"
          count={totalAtivos}
          countSuffix="ativos"
          to="/pipeline"
          cta="Ver pipeline →"
        >
          {isLoading ? (
            <ListSkeleton />
          ) : casosPorTipo.length === 0 ? (
            <Empty icon={Scale} to="/casos/lista" action="Ver casos">
              Nenhum caso cadastrado ainda.
            </Empty>
          ) : (
            <div>
              {casosPorTipo.map((t, i) => (
                <DistBar key={t.tipo} label={t.label} value={t.qtd} max={maxTipo} dim={i >= 3} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Status operacional"
          count={totalAtivos}
          countSuffix="ativos"
          to="/pipeline"
          cta="Ver esteira →"
        >
          {isLoading ? (
            <ListSkeleton />
          ) : casosPorStatus.length === 0 ? (
            <Empty icon={Scale} to="/pipeline" action="Abrir pipeline">
              Nenhum caso cadastrado ainda.
            </Empty>
          ) : (
            <Donut data={casosPorStatus} total={totalAtivos} />
          )}
        </SectionCard>
      </div>

      {/* Urgente + Próximos 7 dias — grid 2 */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <SectionCard
          title="Urgente"
          count={urgentes.length}
          countSuffix={urgentes.length === 1 ? "tarefa" : "tarefas"}
          to="/tarefas"
          cta="Ver tarefas →"
          flush
        >
          {urgentes.length === 0 ? (
            <Empty icon={AlertCircle} to="/tarefas" action="Ver todas as tarefas">
              Nenhuma tarefa urgente em aberto.
            </Empty>
          ) : (
            urgentes.map((t) => (
              <Link
                key={t.id}
                to="/casos/$id"
                params={{ id: t.case_id }}
                className="flex items-center gap-3.5 px-[22px] py-3 transition-colors hover:bg-[var(--ink-50)]"
                style={{ borderTop: "1px solid var(--hv-line-soft)" }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: t.priority === "URGENTE" ? "var(--danger)" : "var(--warning)",
                    boxShadow:
                      t.priority === "URGENTE"
                        ? "0 0 0 3px rgba(176,74,57,0.15)"
                        : "0 0 0 3px rgba(158,113,38,0.15)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-[var(--navy)] leading-snug truncate">
                    {t.title}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 truncate">
                    {t.client_name} · {t.case_code}
                  </div>
                </div>
                <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Próximos 7 dias"
          count={proximosPrazos.length}
          countSuffix={proximosPrazos.length === 1 ? "prazo" : "prazos"}
          to="/tarefas"
          cta="Agenda →"
          flush
        >
          {proximosPrazos.length === 0 ? (
            <Empty icon={Clock} to="/tarefas" action="Abrir agenda">
              Nenhum prazo nos próximos 7 dias.
            </Empty>
          ) : (
            proximosPrazos.map((d) => {
              const dias = daysUntil(d.fatal_date);
              return (
                <Row
                  key={d.id}
                  caseId={d.case_id}
                  primary={d.title}
                  secondary={`${d.client_name} · ${d.case_code}`}
                  trailing={dias < 0 ? `${Math.abs(dias)}d atraso` : `${dias}d`}
                  trailingColor={dias < 0 ? "var(--danger)" : "var(--warning)"}
                />
              );
            })
          )}
        </SectionCard>
      </div>

      {/* Sem movimentação + Casos recentes — grid 2 */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <SectionCard
          title="Sem movimentação"
          count={parados.length}
          countSuffix={parados.length === 1 ? "caso" : "casos"}
          to="/pipeline"
          cta="Ver pipeline →"
          flush
        >
          {isLoading ? (
            <ListSkeleton />
          ) : parados.length === 0 ? (
            <Empty icon={Clock}>Nenhum caso parado há mais de 30 dias.</Empty>
          ) : (
            parados.map((c) => (
              <Row
                key={c.id}
                caseId={c.id}
                primary={c.client_name}
                secondary={c.case_code}
                trailing={`${c.dias}d`}
                trailingColor={c.dias > 45 ? "var(--danger)" : "var(--warning)"}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="Casos recentes" to="/pipeline" cta="Ver todos →" flush>
          {isLoading ? (
            <ListSkeleton />
          ) : casosRecentes.length === 0 ? (
            <Empty icon={Briefcase} to="/casos/lista" action="Ver casos">
              Nenhum caso ainda.
            </Empty>
          ) : (
            casosRecentes.map((c) => (
              <Link
                key={c.id}
                to="/casos/$id"
                params={{ id: c.id }}
                className="flex items-center gap-3 px-[22px] py-3 transition-colors hover:bg-[var(--ink-50)]"
                style={{ borderTop: "1px solid var(--hv-line-soft)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">
                    {c.case_code}
                    <span className="text-muted-foreground font-normal"> · {c.client_name}</span>
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 truncate">
                    {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type} ·{" "}
                    {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                  </div>
                </div>
                <div className="text-[12px] text-muted-foreground shrink-0 tabular">
                  {formatDate(c.created_at)}
                </div>
                <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
              </Link>
            ))
          )}
        </SectionCard>
      </div>

      {/* Clientes recentes — largura total */}
      <SectionCard title="Clientes recentes" to="/clientes" cta="Ver todos →" flush>
        {isLoadingClients ? (
          <ListSkeleton />
        ) : clientesRecentes.length === 0 ? (
          <Empty icon={Users} to="/clientes" action="Ver clientes">
            Nenhum cliente ainda.
          </Empty>
        ) : (
          clientesRecentes.map((c) => (
            <Link
              key={c.id}
              to="/clientes/$id"
              params={{ id: c.id }}
              className="flex items-center gap-3 px-[22px] py-3 transition-colors hover:bg-[var(--ink-50)]"
              style={{ borderTop: "1px solid var(--hv-line-soft)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">
                  {c.full_name}
                </div>
                {c.cpf_cnpj && (
                  <div className="text-[12px] text-muted-foreground mt-0.5 font-mono">
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
      </SectionCard>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  loading,
  danger,
  hero,
  to,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  loading?: boolean;
  danger?: boolean;
  hero?: boolean;
  to?: string;
}) {
  const chipBg = hero
    ? "rgba(198,161,85,0.15)"
    : danger
      ? "rgba(176,74,57,0.08)"
      : "var(--gold-pale)";
  const chipColor = hero ? "var(--hv-gold-soft)" : danger ? "var(--danger)" : GOLD;
  const labelColor = hero ? "rgba(228,199,127,0.85)" : "var(--gold-700)";
  const numColor = hero ? "#F7F2E3" : danger ? "var(--danger)" : NAVY;
  const display = useCountUp(value);

  const content = (
    <div className={hero ? "hv-hero-navy p-5 group" : "card-editorial !p-5 group"}>
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[9.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: labelColor }}
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
        <div className="kpi-number" style={{ color: numColor, fontSize: 32, fontWeight: 650 }}>
          {display}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to as never} className="block">
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
}: {
  caseId: string;
  primary: string;
  secondary: string;
  trailing: string;
  trailingColor: string;
}) {
  return (
    <Link
      to="/casos/$id"
      params={{ id: caseId }}
      className="flex items-center gap-3 px-[22px] py-3 transition-colors hover:bg-[var(--ink-50)]"
      style={{ borderTop: "1px solid var(--hv-line-soft)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-[var(--navy)] truncate">{primary}</div>
        <div className="text-[11.5px] font-mono text-muted-foreground truncate">{secondary}</div>
      </div>
      <div
        className="text-[12.5px] tabular font-semibold shrink-0"
        style={{ color: trailingColor }}
      >
        {trailing}
      </div>
      <ChevronRight size={15} className="text-[var(--ink-300)] shrink-0" />
    </Link>
  );
}

// Card com header DENTRO (handoff v3 .card > .card-h + corpo). O título traz a
// contagem real como sufixo discreto e um link dourado (gold-deep) opcional à
// direita. `flush` = lista sem padding lateral no corpo (linhas com border-top).
function SectionCard({
  title,
  count,
  countSuffix = "ativos",
  to,
  cta,
  flush,
  children,
}: {
  title: string;
  count?: number;
  countSuffix?: string;
  to?: string;
  cta?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="card-editorial !p-0 overflow-hidden">
      <div className="flex items-baseline justify-between px-[22px] pt-[18px]">
        <h3
          className="text-[15px] font-semibold text-[var(--navy)]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
          {count !== undefined && (
            <span className="ml-2 text-[11.5px] font-medium" style={{ color: "var(--hv-muted-2)" }}>
              {count} {countSuffix}
            </span>
          )}
        </h3>
        {to && cta && (
          <Link
            to={to as never}
            className="text-[12px] font-semibold hover:underline"
            style={{ color: "var(--hv-gold-deep)" }}
          >
            {cta}
          </Link>
        )}
      </div>
      <div className={flush ? "" : "px-[22px] pt-4 pb-5"}>{children}</div>
    </div>
  );
}

// Linha de distribuição — grid [nome 124px | trilho | valor], proporcional ao MAX
// (handoff v3 .bar-row). Cor/sombra vêm das classes .hv-bar-* (sem hex inline).
function DistBar({
  label,
  value,
  max,
  dim,
}: {
  label: string;
  value: number;
  max: number;
  dim?: boolean;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="hv-bar-row">
      <span className="text-[13px] font-medium text-[var(--navy)] truncate">{label}</span>
      <div className="hv-bar-track">
        <div className={dim ? "hv-bar-fill dim" : "hv-bar-fill"} style={{ width: `${pct}%` }} />
      </div>
      <span
        className="text-[12.5px] font-semibold tabular text-right"
        style={{ color: "var(--hv-muted)" }}
      >
        {value}
      </span>
    </div>
  );
}

// Donut de distribuição (status operacional) — SVG segmentado + legenda (handoff v3).
const DONUT_COLORS = ["#1C2742", "#A8813B", "#C6A155", "#DDD3BC", "#8A672A", "#B0A48A"];

function Donut({
  data,
  total,
}: {
  data: { status: string; label: string; qtd: number }[];
  total: number;
}) {
  const t = total || 1;
  let cumulative = 0;
  return (
    <div className="flex items-center gap-6">
      <div
        className="relative shrink-0"
        style={{ filter: "drop-shadow(0 6px 14px rgba(21,27,44,0.14))" }}
      >
        <svg width="128" height="128" viewBox="0 0 42 42">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#F0ECE1" strokeWidth="5.4" />
          {data.map((d, i) => {
            const pct = (d.qtd / t) * 100;
            const dashoffset = 25 - cumulative;
            cumulative += pct;
            return (
              <circle
                key={d.status}
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth="5.4"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <b
              className="block text-[26px] font-semibold leading-none"
              style={{ color: "var(--hv-ink-900)", letterSpacing: "-0.04em" }}
            >
              {total}
            </b>
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              casos
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {data.map((d, i) => (
          <div
            key={d.status}
            className="flex items-center gap-2.5 text-[12.5px] text-muted-foreground"
          >
            <span
              className="w-2.5 h-2.5 rounded-[3.5px] shrink-0"
              style={{
                background: DONUT_COLORS[i % DONUT_COLORS.length],
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(21,27,44,0.2)",
              }}
            />
            <span className="truncate">{d.label}</span>
            <b className="ml-auto text-[13px] font-semibold" style={{ color: "var(--hv-ink-900)" }}>
              {d.qtd}
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

// Estado vazio (handoff v3, item 7) — ícone 20px muted-2 + frase + ação dourada
// navegável (só renderiza o link se `to`/`action` forem fornecidos).
function Empty({
  icon: Icon,
  children,
  to,
  action,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  to?: string;
  action?: string;
}) {
  return (
    <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
      {Icon && <Icon size={20} style={{ color: "var(--hv-muted-2)" }} strokeWidth={1.6} />}
      <span className="text-[13px] text-muted-foreground">{children}</span>
      {to && action && (
        <Link
          to={to as never}
          className="text-[12px] font-semibold hover:underline"
          style={{ color: "var(--hv-gold-deep)" }}
        >
          {action} →
        </Link>
      )}
    </div>
  );
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
