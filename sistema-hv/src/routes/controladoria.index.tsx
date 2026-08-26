import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Briefcase,
  CheckSquare,
  ChevronRight,
  CalendarClock,
  Clock,
  Search,
  UserCheck,
  Users,
  Filter,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useControladoria } from "@/hooks/useControladoria";
import { useSetCaseTaskStatus } from "@/hooks/useDossie";
import { useExceptions } from "@/hooks/useExceptions";
import {
  CASE_TYPE_LABELS,
  MACRO_OP_LABELS,
  MACRO_FIN_LABELS,
  type CaseType,
  type MacroOp,
  type MacroFin,
} from "@/lib/cases/constants";

export const Route = createFileRoute("/controladoria/")({
  component: ControladoriaPage,
});

// ---- Constantes de apresentação -------------------------------------------
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

function fmtBRL(centavos: number | null): string {
  if (centavos === null || centavos === undefined) return "·";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---- Página principal -----------------------------------------------------
function ControladoriaPage() {
  const { loading, casos, tarefas, responsaveis, responsaveisNomes, kpis } = useControladoria();
  const { total: excTotal } = useExceptions();

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Inteligência", to: "/hoje" }, { label: "Controladoria" }]} />
      <PageHeader
        eyebrow="Inteligência"
        title="Controladoria"
        subtitle="Controle completo de casos, responsáveis, tarefas e prazos."
      />

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard icon={Briefcase} label="Casos ativos" value={kpis.casosAtivos} />
          <KpiCard
            icon={CheckSquare}
            label="Tarefas abertas"
            value={kpis.tarefasAbertas}
            alert={kpis.tarefasVencidas > 0}
            sub={kpis.tarefasVencidas > 0 ? `${kpis.tarefasVencidas} vencidas` : undefined}
          />
          <KpiCard
            icon={CalendarClock}
            label="Prazos abertos"
            value={kpis.prazosAbertos}
            alert={kpis.prazosVencidos > 0}
            sub={kpis.prazosVencidos > 0 ? `${kpis.prazosVencidos} vencidos` : undefined}
          />
          <KpiCard
            icon={Clock}
            label="Casos parados > 30d"
            value={kpis.casosParados30d}
            alert={kpis.casosParados30d > 0}
          />
          <Link to="/controladoria/excecoes" className="block">
            <KpiCard
              icon={AlertTriangle}
              label="Exceções"
              value={excTotal}
              alert={excTotal > 0}
              clickable
            />
          </Link>
        </div>
      )}

      {/* Abas */}
      <Tabs defaultValue="casos">
        <TabsList className="mb-6">
          <TabsTrigger value="casos" className="gap-1.5">
            <Briefcase size={14} /> Casos
          </TabsTrigger>
          <TabsTrigger value="responsaveis" className="gap-1.5">
            <Users size={14} /> Responsáveis
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-1.5">
            <CheckSquare size={14} /> Tarefas Ativas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="casos">
          <CasosTab casos={casos} responsaveisNomes={responsaveisNomes} loading={loading} />
        </TabsContent>

        <TabsContent value="responsaveis">
          <ResponsaveisTab
            responsaveis={responsaveis}
            casos={casos}
            tarefas={tarefas}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="tarefas">
          <TarefasTab tarefas={tarefas} responsaveisNomes={responsaveisNomes} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- KPI Card -------------------------------------------------------------
function KpiCard({
  icon: Icon,
  label,
  value,
  alert,
  sub,
  clickable,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
  alert?: boolean;
  sub?: string;
  clickable?: boolean;
}) {
  return (
    <div
      className="card-editorial !p-5"
      style={
        alert
          ? { borderColor: "rgba(180,36,50,0.22)" }
          : clickable
            ? { borderColor: "rgba(152,120,20,0.25)" }
            : undefined
      }
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">
          {label}
        </span>
        <Icon size={15} style={{ color: alert ? "var(--danger)" : "var(--ink-400)" }} />
      </div>
      <div
        className="kpi-number"
        style={{
          fontSize: 30,
          color: alert ? "var(--danger)" : "var(--gold-700)",
        }}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] mt-1 text-[var(--danger)] font-medium">{sub}</div>}
    </div>
  );
}

// ---- Aba Casos ------------------------------------------------------------
function CasosTab({
  casos,
  responsaveisNomes,
  loading,
}: {
  casos: ReturnType<typeof useControladoria>["casos"];
  responsaveisNomes: string[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    let result = casos;
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.case_code.toLowerCase().includes(s) ||
          c.client_name.toLowerCase().includes(s) ||
          (c.responsavel?.toLowerCase().includes(s) ?? false) ||
          (c.municipio?.toLowerCase().includes(s) ?? false),
      );
    }
    if (filtroResp) {
      result =
        filtroResp === "__sem"
          ? result.filter((c) => !c.responsavel)
          : result.filter((c) => c.responsavel === filtroResp);
    }
    if (filtroStatus) {
      result = result.filter((c) => c.macrostatus_op === filtroStatus);
    }
    if (filtroTipo) {
      result = result.filter((c) => c.case_type === filtroTipo);
    }
    return result;
  }, [casos, search, filtroResp, filtroStatus, filtroTipo]);

  const sliced = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar código, cliente, responsável…"
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--ink-500)]">
          <Filter size={13} />
        </div>
        <select
          value={filtroResp}
          onChange={(e) => {
            setFiltroResp(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12.5px] focus:border-[var(--gold)] outline-none"
        >
          <option value="">Todos responsáveis</option>
          <option value="__sem">Sem responsável</option>
          {responsaveisNomes.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => {
            setFiltroStatus(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12.5px] focus:border-[var(--gold)] outline-none"
        >
          <option value="">Todos status</option>
          {Object.entries(MACRO_OP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => {
            setFiltroTipo(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12.5px] focus:border-[var(--gold)] outline-none"
        >
          <option value="">Todos tipos</option>
          {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="card-editorial !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--gold-pale)]/40 border-b border-[var(--border)]">
                {[
                  "Código",
                  "Cliente",
                  "Tipo",
                  "Status Op.",
                  "Responsável",
                  "Tarefas",
                  "Prazos",
                  "Parado",
                  "Valor",
                ].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5">
                    <Eyebrow>{h}</Eyebrow>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[rgba(152,120,20,0.08)]">
                    <td colSpan={9} className="px-4 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              ) : sliced.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum caso encontrado.
                  </td>
                </tr>
              ) : (
                sliced.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[rgba(152,120,20,0.08)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[12px]">
                      <Link
                        to="/casos/$id"
                        params={{ id: c.id }}
                        className="text-[var(--gold-700)] hover:underline font-medium"
                      >
                        {c.case_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-[var(--navy)] shrink-0"
                          style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
                        >
                          {c.client_name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="font-medium text-[var(--navy)] truncate max-w-[160px]">
                          {c.client_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-soft badge-soft--navy text-[11px]">
                        {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.responsavel ? (
                        <div className="flex items-center gap-1.5">
                          <UserCheck size={12} className="text-[var(--ink-400)]" />
                          <span className="text-[12.5px]">{c.responsavel}</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-[var(--danger)]">Sem responsável</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.tarefasAbertas > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-[12px] font-medium"
                          style={{
                            color: c.tarefasVencidas > 0 ? "var(--danger)" : "var(--ink-600)",
                          }}
                        >
                          {c.tarefasAbertas}
                          {c.tarefasVencidas > 0 && (
                            <AlertTriangle size={11} className="text-[var(--danger)]" />
                          )}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--ink-300)]">·</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.prazosAbertos > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-[12px] font-medium"
                          style={{
                            color: c.prazosVencidos > 0 ? "var(--danger)" : "var(--ink-600)",
                          }}
                        >
                          {c.prazosAbertos}
                          {c.prazosVencidos > 0 && (
                            <AlertTriangle size={11} className="text-[var(--danger)]" />
                          )}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--ink-300)]">·</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.diasParado > 30 ? (
                        <span
                          className="text-[12px] font-semibold"
                          style={{
                            color: c.diasParado > 45 ? "var(--danger)" : "var(--warning)",
                          }}
                        >
                          {c.diasParado}d
                        </span>
                      ) : c.diasParado > 0 ? (
                        <span className="text-[12px] text-[var(--ink-400)]">{c.diasParado}d</span>
                      ) : (
                        <span className="text-[12px] text-[var(--ink-300)]">·</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--navy)]">
                      {fmtBRL(c.valor_centavos)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              Página {page + 1} de {totalPages} · {filtered.length} casos
            </span>
            <div className="flex gap-2">
              <Btn
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Btn>
              <Btn
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Próximo
              </Btn>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---- Aba Responsáveis -----------------------------------------------------
function ResponsaveisTab({
  responsaveis,
  casos,
  tarefas,
  loading,
}: {
  responsaveis: ReturnType<typeof useControladoria>["responsaveis"];
  casos: ReturnType<typeof useControladoria>["casos"];
  tarefas: ReturnType<typeof useControladoria>["tarefas"];
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {responsaveis.length === 0 ? (
        <div className="card-editorial !p-8 text-center text-muted-foreground text-[13px]">
          Nenhum responsável encontrado.
        </div>
      ) : (
        responsaveis.map((r) => {
          const isOpen = expanded === r.name;
          const respCasos = casos.filter((c) => (c.responsavel || "Sem responsável") === r.name);
          const respTarefas = tarefas.filter((t) => (t.assignee || "Sem responsável") === r.name);
          const hasIssues = r.tarefasVencidas > 0 || r.prazosVencidos > 0;

          return (
            <div
              key={r.name}
              className="card-editorial !p-0 overflow-hidden"
              style={hasIssues ? { borderColor: "rgba(180,36,50,0.18)" } : undefined}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : r.name)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--ink-50)] transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-[var(--navy)] shrink-0"
                  style={{
                    background:
                      r.name === "Sem responsável"
                        ? "var(--ink-100)"
                        : "linear-gradient(135deg, #fbf3dd, #d4a832)",
                  }}
                >
                  {r.name === "Sem responsável" ? "?" : (r.name[0]?.toUpperCase() ?? "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--navy)]">{r.name}</div>
                  <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground mt-0.5">
                    <span>
                      {r.casosCount} caso{r.casosCount !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>
                      {r.tarefasAbertas} tarefa{r.tarefasAbertas !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>
                      {r.prazosAbertos} prazo{r.prazosAbertos !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.tarefasVencidas > 0 && (
                    <span className="badge-soft badge-soft--danger text-[10.5px]">
                      {r.tarefasVencidas} vencida{r.tarefasVencidas !== 1 ? "s" : ""}
                    </span>
                  )}
                  {r.prazosVencidos > 0 && (
                    <span className="badge-soft badge-soft--danger text-[10.5px]">
                      {r.prazosVencidos} prazo{r.prazosVencidos !== 1 ? "s" : ""} vencido
                      {r.prazosVencidos !== 1 ? "s" : ""}
                    </span>
                  )}
                  <ChevronRight
                    size={16}
                    className={`text-[var(--ink-300)] transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[var(--border)]">
                  {/* Casos do responsável */}
                  {respCasos.length > 0 && (
                    <div className="px-5 py-3">
                      <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] mb-2">
                        Casos ({respCasos.length})
                      </div>
                      <div className="space-y-1">
                        {respCasos.map((c) => (
                          <Link
                            key={c.id}
                            to="/casos/$id"
                            params={{ id: c.id }}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--ink-50)] transition-colors"
                          >
                            <span className="font-mono text-[11.5px] text-[var(--gold-700)] font-medium">
                              {c.case_code}
                            </span>
                            <span className="text-[12.5px] text-[var(--navy)] truncate flex-1">
                              {c.client_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                            </span>
                            {c.tarefasAbertas > 0 && (
                              <span className="text-[11px] text-[var(--ink-500)]">
                                {c.tarefasAbertas} tarefa{c.tarefasAbertas !== 1 ? "s" : ""}
                              </span>
                            )}
                            <ChevronRight size={13} className="text-[var(--ink-300)]" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Tarefas do responsável */}
                  {respTarefas.length > 0 && (
                    <div className="px-5 py-3 border-t border-[var(--border)]">
                      <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] mb-2">
                        Tarefas ativas ({respTarefas.length})
                      </div>
                      <div className="space-y-1">
                        {respTarefas.map((t) => (
                          <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                background:
                                  t.diasAtraso > 0
                                    ? "var(--danger)"
                                    : (PRIO_TONE[t.priority] ?? "var(--ink-400)"),
                              }}
                            />
                            <Link
                              to="/casos/$id"
                              params={{ id: t.case_id }}
                              className="text-[12.5px] text-[var(--navy)] hover:underline truncate flex-1"
                            >
                              {t.title}
                            </Link>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {t.case_code}
                            </span>
                            {t.diasAtraso > 0 && (
                              <span className="text-[11px] font-semibold text-[var(--danger)]">
                                {t.diasAtraso}d atraso
                              </span>
                            )}
                            <span
                              className="text-[10.5px] font-medium"
                              style={{ color: PRIO_TONE[t.priority] ?? "var(--ink-400)" }}
                            >
                              {PRIO_LABEL[t.priority] ?? t.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {respCasos.length === 0 && respTarefas.length === 0 && (
                    <div className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
                      Nenhum caso ou tarefa associado.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ---- Aba Tarefas Ativas ---------------------------------------------------
function TarefasTab({
  tarefas,
  responsaveisNomes,
  loading,
}: {
  tarefas: ReturnType<typeof useControladoria>["tarefas"];
  responsaveisNomes: string[];
  loading: boolean;
}) {
  const [filtroResp, setFiltroResp] = useState("");
  const [filtroPrio, setFiltroPrio] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = [...tarefas].sort(
      (a, b) =>
        b.diasAtraso - a.diasAtraso ||
        (PRIO_ORDER[a.priority] ?? 9) - (PRIO_ORDER[b.priority] ?? 9),
    );
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          t.case_code.toLowerCase().includes(s) ||
          t.client_name.toLowerCase().includes(s) ||
          (t.assignee?.toLowerCase().includes(s) ?? false),
      );
    }
    if (filtroResp) {
      result =
        filtroResp === "__sem"
          ? result.filter((t) => !t.assignee)
          : result.filter((t) => t.assignee === filtroResp);
    }
    if (filtroPrio) {
      result = result.filter((t) => t.priority === filtroPrio);
    }
    return result;
  }, [tarefas, search, filtroResp, filtroPrio]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefa, caso ou cliente…"
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <select
          value={filtroResp}
          onChange={(e) => setFiltroResp(e.target.value)}
          className="px-3 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12.5px] focus:border-[var(--gold)] outline-none"
        >
          <option value="">Todos responsáveis</option>
          <option value="__sem">Sem responsável</option>
          {responsaveisNomes.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={filtroPrio}
          onChange={(e) => setFiltroPrio(e.target.value)}
          className="px-3 py-2 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12.5px] focus:border-[var(--gold)] outline-none"
        >
          <option value="">Todas prioridades</option>
          {Object.entries(PRIO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-muted-foreground">
          {filtered.length} tarefa{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Lista */}
      <div className="card-editorial !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-[13px]">
            Nenhuma tarefa encontrada.
          </div>
        ) : (
          filtered.map((t, i) => (
            <TarefaRow key={t.id} tarefa={t} last={i === filtered.length - 1} />
          ))
        )}
      </div>
    </>
  );
}

function TarefaRow({
  tarefa: t,
  last,
}: {
  tarefa: ReturnType<typeof useControladoria>["tarefas"][number];
  last: boolean;
}) {
  const markDone = useSetCaseTaskStatus(t.case_id);

  function handleComplete() {
    if (markDone.isPending) return;
    // TK1 — clique rápido = concluída COM sucesso (mesma decisão do dossiê).
    markDone.mutate({ id: t.id, status: "CONCLUIDA_SUCESSO" });
  }

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--ink-50)] transition-colors"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      {/* Botão concluir */}
      <button
        type="button"
        onClick={handleComplete}
        disabled={markDone.isPending}
        className="w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors hover:bg-[var(--success)] hover:border-[var(--success)] hover:text-white"
        style={{
          borderColor: t.diasAtraso > 0 ? "var(--danger)" : "rgba(152,120,20,0.3)",
        }}
        title="Marcar como concluída"
      >
        {markDone.isPending && (
          <span className="w-3 h-3 border-2 border-[var(--ink-400)] border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--navy)] truncate">{t.title}</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <Link
            to="/casos/$id"
            params={{ id: t.case_id }}
            className="font-mono text-[var(--gold-700)] hover:underline"
          >
            {t.case_code}
          </Link>
          <span>·</span>
          <span className="truncate">{t.client_name}</span>
          {t.assignee && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserCheck size={10} />
                {t.assignee}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Atraso */}
      {t.diasAtraso > 0 && (
        <span className="text-[11.5px] font-semibold text-[var(--danger)] shrink-0">
          {t.diasAtraso}d atraso
        </span>
      )}

      {/* Prioridade */}
      <span
        className="text-[11px] font-medium shrink-0 px-2 py-0.5 rounded-full"
        style={{
          color: PRIO_TONE[t.priority] ?? "var(--ink-500)",
          background: "rgba(0,0,0,0.03)",
          border: "1px solid var(--border)",
        }}
      >
        {PRIO_LABEL[t.priority] ?? t.priority}
      </span>

      {/* Link para o caso */}
      <Link to="/casos/$id" params={{ id: t.case_id }}>
        <ChevronRight size={15} className="text-[var(--ink-300)]" />
      </Link>
    </div>
  );
}
