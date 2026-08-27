import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  List,
  Settings,
  Calendar,
  AlertTriangle,
  History,
  TrendingUp,
  FileText,
  LayoutGrid,
  Inbox,
  ClipboardCheck,
  ScrollText,
  ListChecks,
} from "lucide-react";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";

export const Route = createFileRoute("/controladoria/distribuicao")({
  component: DistribuicaoLayout,
});

// Abas agrupadas por finalidade (rearquitetura 2026-08-10): OPERAÇÃO (fluxo do
// dia) · CONFIGURAÇÃO (fora do fluxo) · AUDITORIA (secundário). A aba "Executores"
// foi REMOVIDA — a configuração do executor migrou para Usuários/Permissões (os
// dados/tabela `system_projuris_executor_mapping` permanecem intactos).
type Tab = { to: string; label: string; icon: typeof BarChart3; exact?: boolean };
const tabGroups: Array<{ group: string; tabs: Tab[] }> = [
  {
    group: "Operação",
    tabs: [
      { to: "/controladoria/distribuicao", label: "Painel", icon: BarChart3, exact: true },
      // Doc 21.08 — as duas etapas humanas, na ordem do fluxo do dia:
      // 1) o que o ProJuris registrou → decisão; 2) o que foi mandado distribuir → revisão.
      {
        to: "/controladoria/distribuicao/andamentos",
        label: "Andamentos pendentes",
        icon: Inbox,
      },
      {
        to: "/controladoria/distribuicao/a-distribuir",
        label: "A distribuir",
        icon: ClipboardCheck,
      },
      { to: "/controladoria/distribuicao/lista", label: "Lista", icon: List },
      { to: "/controladoria/distribuicao/excecoes", label: "Exceções", icon: AlertTriangle },
      { to: "/controladoria/distribuicao/calendario", label: "Calendário", icon: Calendar },
      { to: "/controladoria/distribuicao/kanban", label: "Kanban", icon: LayoutGrid },
    ],
  },
  {
    group: "Configuração",
    // AJ1 (Thiago, 27/08): o menu do motor não repete o que já é configuração do
    // SISTEMA. Saíram daqui, nesta ordem de raciocínio:
    //   · "Tipos Tarefa" e "Temas" eram só ATALHOS para /configuracoes (T1 e T2) —
    //     o cadastro nunca esteve aqui, então nada se perde;
    //   · "Vínculos" (caso ↔ processo do ProJuris) passa a ser feito na aba
    //     Judicial da ficha do caso, que é onde a informação vive;
    //   · "Simulador" saiu de Auditoria — é ferramenta de teste, não de operação.
    // As ROTAS continuam existindo e acessíveis por URL; só não figuram no menu.
    tabs: [
      { to: "/controladoria/distribuicao/configuracao", label: "Configuração", icon: Settings },
    ],
  },
  {
    group: "Auditoria",
    tabs: [
      // Doc 21.08, páginas 3 e 4 — dois históricos distintos: o dos ANDAMENTOS
      // (o que entrou e o que foi decidido) e o das TAREFAS (o que o motor
      // distribuiu). A aba "Execuções" continua sendo o log dos batches.
      {
        to: "/controladoria/distribuicao/historico-andamentos",
        label: "Hist. andamentos",
        icon: ScrollText,
      },
      {
        to: "/controladoria/distribuicao/historico-tarefas",
        label: "Hist. tarefas",
        icon: ListChecks,
      },
      { to: "/controladoria/distribuicao/historico", label: "Execuções", icon: History },
      { to: "/controladoria/distribuicao/indicadores", label: "Indicadores", icon: TrendingUp },
      { to: "/controladoria/distribuicao/relatorio", label: "Relatório", icon: FileText },
    ],
  },
];

function DistribuicaoLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function isActive(tab: Tab) {
    const clean = pathname.replace(/\/$/, "") || "/";
    const tabClean = tab.to.replace(/\/$/, "") || "/";
    return clean === tabClean;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="px-6 pt-4 pb-0">
          <Breadcrumb
            items={[{ label: "Controladoria", to: "/controladoria" }, { label: "Distribuicao" }]}
          />
          <PageHeader
            title="Motor de Distribuicao"
            subtitle="Distribuicao automatica de tarefas judiciais"
          />
        </div>
        <nav className="flex items-stretch gap-1 px-6 overflow-x-auto scrollbar-hide">
          {tabGroups.map((g, gi) => (
            <div key={g.group} className="flex items-center">
              {gi > 0 && <div className="mx-2 h-5 w-px self-center bg-border" />}
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                {g.group}
              </span>
              {g.tabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab);
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Conteudo da sub-rota */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
