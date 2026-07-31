import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  List,
  UserCheck,
  Settings,
  Calendar,
  AlertTriangle,
  History,
  TrendingUp,
  FlaskConical,
  FileText,
  Tags,
  Layers,
} from "lucide-react";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";

export const Route = createFileRoute("/controladoria/distribuicao")({
  component: DistribuicaoLayout,
});

const tabs = [
  { to: "/controladoria/distribuicao", label: "Painel", icon: BarChart3, exact: true },
  { to: "/controladoria/distribuicao/lista", label: "Lista", icon: List },
  { to: "/controladoria/distribuicao/executores", label: "Executores", icon: UserCheck },
  { to: "/controladoria/distribuicao/calendario", label: "Calendario", icon: Calendar },
  { to: "/controladoria/distribuicao/tipos-tarefa", label: "Tipos Tarefa", icon: Tags },
  { to: "/controladoria/distribuicao/temas", label: "Temas", icon: Layers },
  { to: "/controladoria/distribuicao/excecoes", label: "Excecoes", icon: AlertTriangle },
  { to: "/controladoria/distribuicao/historico", label: "Historico", icon: History },
  { to: "/controladoria/distribuicao/indicadores", label: "Indicadores", icon: TrendingUp },
  { to: "/controladoria/distribuicao/simulador", label: "Simulador", icon: FlaskConical },
  { to: "/controladoria/distribuicao/relatorio", label: "Relatorio", icon: FileText },
  { to: "/controladoria/distribuicao/configuracao", label: "Configuracao", icon: Settings },
] as const;

function DistribuicaoLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function isActive(tab: (typeof tabs)[number]) {
    const clean = pathname.replace(/\/$/, "") || "/";
    const tabClean = tab.to.replace(/\/$/, "") || "/";
    if ("exact" in tab && tab.exact) return clean === tabClean;
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
        <nav className="flex gap-1 px-6 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
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
        </nav>
      </div>

      {/* Conteudo da sub-rota */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
