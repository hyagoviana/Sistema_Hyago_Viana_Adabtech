import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Clock, Briefcase, CheckSquare, DollarSign, FileText, MoreHorizontal, ChevronRight } from "lucide-react";
import { PageHeader, SectionHeader, Card, StatCard, Btn, StatusDot } from "@/components/hv/primitives";
import { useCasesList } from "@/hooks/useCases";
import { useAuth } from "@/lib/auth";
import { tarefas, casos, fmtBRL } from "@/mocks/fixtures";

export const Route = createFileRoute("/hoje")({
  component: HojePage,
});

const spark = (seed: number) =>
  Array.from({ length: 30 }, (_, i) =>
    Math.round(50 + 20 * Math.sin((i + seed) / 3) + (i * seed) % 17),
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
    <div className="page-container">
      <PageHeader
        title={nome ? `${saudacao}, ${nome}` : saudacao}
        subtitle={`${casosAtivos} ${casosAtivos === 1 ? "caso ativo" : "casos ativos"} no sistema.`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Casos ativos" value={casosAtivos} spark={spark(1)} />
        <StatCard label="Tarefas hoje" value="23" delta={{ value: "↓ 5 vs ontem", up: false }} spark={spark(3)} />
        <StatCard label="Prazos críticos" value="06" delta={{ value: "↑ 2 vs ontem", up: false }} spark={spark(5)} />
        <StatCard label="Faturamento mês" value="R$ 312k" delta={{ value: "↑ 8% vs abril", up: true }} spark={spark(7)} />
      </div>

      {/* Urgente */}
      <SectionHeader
        title="Urgente"
        count={urgentes.length}
        action={
          <Link to="/tarefas" className="text-[12px] text-[#525252] hover:text-[var(--navy)] flex items-center gap-1">
            Ver todas <ChevronRight size={12} />
          </Link>
        }
      />
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {urgentes.map((t) => (
          <UrgentCard key={t.id} task={t} />
        ))}
      </div>

      {/* Próximos prazos */}
      <SectionHeader
        title="Próximos 7 dias"
        count={proximos.length}
        action={
          <Link to="/tarefas" className="text-[12px] text-[#525252] hover:text-[var(--navy)] flex items-center gap-1">
            Ver agenda <ChevronRight size={12} />
          </Link>
        }
      />
      <Card className="!p-0 mb-6 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Tarefa</th>
              <th>Caso</th>
              <th>Vencimento</th>
              <th>Responsável</th>
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {proximos.map((t) => (
              <tr key={t.id}>
                <td>
                  <FileText size={14} className="text-[#a3a3a3]" />
                </td>
                <td className="font-medium text-[var(--navy)]">{t.titulo}</td>
                <td className="font-mono text-[12px] text-[#525252]">{t.caso}</td>
                <td className="tabular text-[#525252]">
                  {t.dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </td>
                <td className="text-[#525252]">{t.responsavel}</td>
                <td>
                  <button className="text-[#a3a3a3] hover:text-[var(--navy)]">
                    <MoreHorizontal size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Two columns: Atividade + Sem movimentação */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div>
          <SectionHeader title="Atividade recente" />
          <Card className="!p-4">
            <ul className="space-y-3">
              {[
                { who: "Maria", action: "aprovou termo", target: "FIES-2026-0042", when: "há 2h" },
                { who: "João", action: "protocolou recurso", target: "MM-2026-0118", when: "há 3h" },
                { who: "Ana", action: "criou tarefa", target: "RES-2026-0009", when: "há 5h" },
                { who: "Carlos", action: "comentou no caso", target: "FIES-2026-0033", when: "há 6h" },
                { who: "Maria", action: "ativou cliente", target: "CFM-2026-0021", when: "há 8h" },
                { who: "Sistema", action: "sincronizou MEC", target: "12 casos", when: "ontem" },
              ].map((e, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px]">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold text-[#1e2044]"
                    style={{ background: "#f5f5f5" }}
                  >
                    {e.who[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-[var(--navy)]">{e.who}</span>{" "}
                    <span className="text-[#525252]">{e.action}</span>{" "}
                    <span className="font-mono text-[12px] text-[var(--navy)]">{e.target}</span>
                  </div>
                  <span className="text-[11px] text-[#a3a3a3] shrink-0">{e.when}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <SectionHeader title="Casos sem movimentação > 30d" count={parados.length} />
          <Card className="!p-0 overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Parado</th>
                  <th>Responsável</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parados.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono text-[12px]">{c.codigo}</td>
                    <td className="truncate max-w-[140px]">{c.clienteNome}</td>
                    <td
                      className="tabular font-semibold"
                      style={{ color: c.diasNoEstado > 45 ? "var(--danger)" : "var(--warning)" }}
                    >
                      {c.diasNoEstado}d
                    </td>
                    <td className="text-[#525252]">{c.responsavel}</td>
                    <td>
                      <Btn variant="outline" size="sm">Ver</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

function UrgentCard({ task }: { task: typeof tarefas[number] }) {
  return (
    <Card className="!p-4">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={14} className="text-[var(--danger)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-[var(--navy)] leading-snug">
            {task.titulo}
          </div>
          <div className="text-[11.5px] font-mono text-[#525252] mt-0.5">{task.caso}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid #f5f5f5" }}>
        <div className="flex items-center gap-1.5 text-[11.5px] text-[#525252]">
          <Clock size={11} />
          {task.dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          <span className="text-[#d4d4d4]">·</span>
          {task.responsavel}
        </div>
        <Btn variant="outline" size="sm">Abrir</Btn>
      </div>
    </Card>
  );
}
