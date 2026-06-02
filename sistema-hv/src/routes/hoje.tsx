import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Clock,
  Briefcase,
  CheckSquare,
  CalendarClock,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useCasesList } from "@/hooks/useCases";
import { useAuth } from "@/lib/auth";
import { tarefas, casos } from "@/mocks/fixtures";

export const Route = createFileRoute("/hoje")({
  component: HojePage,
});

const spark = (seed: number) =>
  Array.from({ length: 30 }, (_, i) =>
    Math.round(50 + 20 * Math.sin((i + seed) / 3) + ((i * seed) % 17)),
  );

function HojePage() {
  const { session } = useAuth();
  const { data: casosReais } = useCasesList();
  const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const nome = meta?.full_name || meta?.name || "";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const casosAtivos = (casosReais ?? []).length;

  const urgentes = tarefas.filter((t) => t.prioridade === "urgente").slice(0, 3);
  const proximos = tarefas.slice(0, 5);
  const parados = casos.filter((c) => c.diasNoEstado > 30).slice(0, 5);

  return (
    <div className="premium-dark min-h-screen text-white">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-9">
        {/* Saudação */}
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#c9a634] mb-2">
            Painel executivo
          </div>
          <h1 className="font-display text-[34px] leading-tight text-white">
            {nome ? `${saudacao}, ${nome}` : saudacao}
          </h1>
          <p className="text-white/55 mt-1.5 text-[14px]">
            {casosAtivos} {casosAtivos === 1 ? "caso ativo" : "casos ativos"} no sistema.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Kpi
            label="Casos ativos"
            value={String(casosAtivos)}
            icon={Briefcase}
            data={spark(1)}
            color="#c9a634"
            id="k1"
          />
          <Kpi
            label="Tarefas hoje"
            value="23"
            delta="↓ 5 vs ontem"
            deltaUp
            icon={CheckSquare}
            data={spark(3)}
            color="#6fa8ff"
            id="k2"
          />
          <Kpi
            label="Prazos críticos"
            value="06"
            delta="↑ 2 vs ontem"
            icon={CalendarClock}
            data={spark(5)}
            color="#ff8a92"
            id="k3"
          />
          <Kpi
            label="Faturamento mês"
            value="R$ 312k"
            delta="↑ 8% vs abril"
            deltaUp
            icon={DollarSign}
            data={spark(7)}
            color="#c9a634"
            id="k4"
            featured
          />
        </div>

        {/* Urgente */}
        <SectionHead title="Urgente" count={urgentes.length} to="/tarefas" cta="Ver todas" />
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {urgentes.map((t) => (
            <div key={t.id} className="glass-card p-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={15} className="text-[#ff8a92] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-white leading-snug">{t.titulo}</div>
                  <div className="text-[11.5px] font-mono text-white/45 mt-0.5">{t.caso}</div>
                </div>
              </div>
              <div
                className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-1.5 text-[11.5px] text-white/55">
                  <Clock size={11} />
                  {t.dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  <span className="text-white/25">·</span>
                  {t.responsavel}
                </div>
                <button className="text-[12px] font-medium text-[#c9a634] hover:text-[#e0c45a]">
                  Abrir
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Próximos 7 dias + Sem movimentação */}
        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <SectionHead title="Próximos 7 dias" count={proximos.length} to="/tarefas" cta="Agenda" />
            <div className="glass-card overflow-hidden">
              {proximos.map((t, i) => (
                <Link
                  key={t.id}
                  to="/tarefas"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]"
                  style={
                    i < proximos.length - 1
                      ? { borderBottom: "1px solid rgba(255,255,255,0.06)" }
                      : undefined
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-white truncate">{t.titulo}</div>
                    <div className="text-[11.5px] font-mono text-white/40">{t.caso}</div>
                  </div>
                  <div className="text-[12px] tabular text-white/55 shrink-0">
                    {t.dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <SectionHead title="Sem movimentação > 30d" count={parados.length} />
            <div className="glass-card overflow-hidden">
              {parados.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={
                    i < parados.length - 1
                      ? { borderBottom: "1px solid rgba(255,255,255,0.06)" }
                      : undefined
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white truncate">{c.clienteNome}</div>
                    <div className="text-[11.5px] font-mono text-white/40">{c.codigo}</div>
                  </div>
                  <div
                    className="text-[12.5px] tabular font-semibold shrink-0"
                    style={{ color: c.diasNoEstado > 45 ? "#ff8a92" : "#e0b84a" }}
                  >
                    {c.diasNoEstado}d
                  </div>
                  <ChevronRight size={15} className="text-white/30 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  deltaUp,
  icon: Icon,
  data,
  color,
  id,
  featured,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  icon: LucideIcon;
  data: number[];
  color: string;
  id: string;
  featured?: boolean;
}) {
  return (
    <div
      className="glass-card p-5 relative overflow-hidden"
      style={
        featured
          ? { borderColor: "rgba(201,166,52,0.3)", boxShadow: "0 18px 40px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,166,52,0.18)" }
          : undefined
      }
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</span>
        <Icon size={15} style={{ color }} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div
            className="kpi-number"
            style={{ color: featured ? "#e7c45a" : "#ffffff", fontSize: featured ? 32 : 28 }}
          >
            {value}
          </div>
          {delta && (
            <div className="text-[11.5px] mt-1" style={{ color: deltaUp ? "#5fd0a0" : "#ff8a92" }}>
              {delta}
            </div>
          )}
        </div>
        <Spark data={data} color={color} id={id} />
      </div>
    </div>
  );
}

function Spark({ data, color, id }: { data: number[]; color: string; id: string }) {
  const w = 110;
  const h = 36;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map(
    (v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * h] as const,
  );
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
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
        <h2 className="font-display text-[18px] text-white">{title}</h2>
        {count !== undefined && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
            {count}
          </span>
        )}
      </div>
      {to && cta && (
        <Link
          to={to}
          className="text-[12px] text-white/55 hover:text-[#c9a634] flex items-center gap-1 transition-colors"
        >
          {cta} <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}
