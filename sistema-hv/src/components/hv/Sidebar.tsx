import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Briefcase,
  DollarSign,
  Users,
  CheckSquare,
  Scale,
  FileText,
  TrendingUp,
  Megaphone,
  MessageCircle,
  BarChart3,
  LayoutGrid,
  Palette,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  FileSignature,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signOut, useAuth } from "@/lib/auth";
import { useCasesList } from "@/hooks/useCases";
import { useAllTasks } from "@/hooks/useDossie";
import { useExceptions } from "@/hooks/useExceptions";
import { canSeeRoute, ROLE_LABELS } from "@/lib/rbac";
import symbolHV from "@/assets/symbol-hv.png";

const COLLAPSE_KEY = "hv:sidebar-collapsed";

// Paleta de leitura sobre o navy #1e2044 — gold CLARO/luminoso (champanhe) p/ o
// TEXTO e ícones, igual ao tom da topbar (contraste AA folgado, ~9:1). O gold
// escuro #987814 fica reservado só pra preenchimentos/acentos sólidos.
const GOLD_BRIGHT = "#e9cd84";
const TEXT_IDLE = "rgba(233,205,132,0.85)";
const TEXT_HOVER = "#f6e3ac";
const TEXT_ACTIVE = GOLD_BRIGHT;
const ICON_IDLE = "rgba(233,205,132,0.85)";
const GROUP_LABEL = "rgba(233,205,132,0.5)";

type BadgeTone = "neutral" | "gold" | "danger";
type Item = { to: string; label: string; icon: LucideIcon; count?: number; tone?: BadgeTone };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Operação",
    items: [
      { to: "/hoje", label: "Hoje", icon: Home },
      { to: "/pipeline", label: "Pipeline Operacional", icon: Briefcase },
      { to: "/casos/financeiro", label: "Pipeline Financeira", icon: DollarSign },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/tarefas", label: "Tarefas", icon: CheckSquare },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { to: "/controladoria", label: "Controladoria", icon: Scale },
      { to: "/peticionamento", label: "Peticionamento", icon: FileText },
      { to: "/inteligencia/leads", label: "Cadastro", icon: UserPlus },
      { to: "/comercial", label: "Comercial", icon: TrendingUp },
      { to: "/comercial/leads", label: "Pipeline comercial", icon: LayoutGrid },
      { to: "/comercial/assinaturas", label: "Assinaturas", icon: FileSignature, tone: "gold" },
      { to: "/marketing", label: "Marketing", icon: Megaphone },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/dashboards", label: "Dashboards", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/design-system", label: "Design System", icon: Palette },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

function Badge({ count, tone = "neutral" }: { count: number; tone?: BadgeTone }) {
  const styles: Record<BadgeTone, React.CSSProperties> = {
    neutral: {
      background: "rgba(255,255,255,0.06)",
      color: "rgba(232,232,232,0.75)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    gold: {
      background: "rgba(152,120,20,0.14)",
      color: "#d4b04a",
      border: "1px solid rgba(152,120,20,0.35)",
    },
    danger: {
      background: "rgba(220,80,90,0.14)",
      color: "#ff8a92",
      border: "1px solid rgba(220,80,90,0.3)",
    },
  };
  return (
    <span className="sidebar-badge" style={styles[tone]}>
      {count}
    </span>
  );
}

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const [collapsed, setCollapsed] = useState(false);
  // Persistência sem libs novas: lê do localStorage após montar (evita mismatch
  // de hidratação SSR) e grava a cada toggle.
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* localStorage indisponível — mantém expandida */
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Apenas o item MAIS específico fica ativo: entre os que casam com o path,
  // vence o de maior comprimento (ex.: /casos/financeiro vence /casos), evitando
  // que Pipeline Operacional e Financeira acendam juntas.
  const activeTo = groups
    .flatMap((g) => g.items)
    .filter((it) => path === it.to || path.startsWith(it.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;

  const { session, role } = useAuth();
  const { data: casos } = useCasesList();
  const { data: tasks } = useAllTasks();
  const { total: excTotal } = useExceptions();

  // Contadores REAIS (Supabase): casos, bifurcados na financeira e tarefas abertas.
  const realCounts: Record<string, number> = {};
  if (casos) {
    realCounts["/casos"] = casos.length;
    realCounts["/pipeline"] = casos.length;
    realCounts["/casos/financeiro"] = casos.filter(
      (c) => c.macrostatus_fin !== "NAO_APLICAVEL",
    ).length;
    const aguardando = casos.filter(
      (c) => (c as { aguardando_assinatura_at?: string | null }).aguardando_assinatura_at,
    ).length;
    if (aguardando > 0) realCounts["/comercial/assinaturas"] = aguardando;
  }
  if (tasks) {
    realCounts["/tarefas"] = tasks.filter((t) => t.status !== "CONCLUIDA").length;
  }
  if (excTotal > 0) {
    realCounts["/controladoria"] = excTotal;
  }

  const navigate = useNavigate();
  const email = session?.user?.email ?? "";
  const displayName = email ? email.split("@")[0] : "Usuário";
  const initial = (email[0] ?? "?").toUpperCase();

  // Filtra grupos/itens pelo papel. Enquanto o papel não carregou (null),
  // mostra tudo para não "piscar" o menu — os gates de ação seguram o resto.
  const visibleGroups = role
    ? groups
        .map((g) => ({ ...g, items: g.items.filter((it) => canSeeRoute(role, it.to)) }))
        .filter((g) => g.items.length > 0)
    : groups;

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen text-white"
        style={{
          width: collapsed ? 64 : 256,
          transition: "width 200ms ease",
          background: "linear-gradient(180deg, #1e2044 0%, #181a33 60%, #14162e 100%)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
          boxShadow: "1px 0 0 rgba(0,0,0,0.4), 6px 0 24px -8px rgba(0,0,0,0.35)",
        }}
      >
        {/* Brand + toggle */}
        <div
          className={
            collapsed
              ? "flex flex-col items-center gap-2 px-2 pt-4 pb-3"
              : "flex items-center justify-between px-4 pt-5 pb-4"
          }
        >
          <Link
            to="/hoje"
            className="flex items-center gap-2.5 min-w-0"
            aria-label="Hyago Viana Advocacia"
          >
            <img src={symbolHV} alt="" className="h-7 w-auto object-contain shrink-0" />
            {!collapsed && (
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-white tracking-tight">
                  Hyago Viana
                </div>
                <div
                  className="text-[9.5px] font-medium uppercase"
                  style={{ color: "rgba(233,205,132,0.9)", letterSpacing: "0.22em" }}
                >
                  Advocacia
                </div>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-expanded={!collapsed}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: ICON_IDLE }}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.8} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.8} />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-1 pb-4">
          {visibleGroups.map((g, idx) => (
            <div
              key={g.label}
              className={idx === 0 ? "" : "mt-4 pt-4"}
              style={idx === 0 ? undefined : { borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              {!collapsed && (
                <div
                  className="px-3 mb-2 text-[10.5px] uppercase font-semibold"
                  style={{ color: GROUP_LABEL, letterSpacing: "0.16em" }}
                >
                  {g.label}
                </div>
              )}
              <ul className="space-y-[2px]">
                {g.items.map((item) => {
                  const active = item.to === activeTo;
                  const Icon = item.icon;
                  const count = realCounts[item.to];
                  const hasCount = count !== undefined && count > 0;

                  const idleStyle: React.CSSProperties = active
                    ? {
                        background: "rgba(152,120,20,0.18)",
                        border: "1px solid rgba(152,120,20,0.35)",
                        color: TEXT_ACTIVE,
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 14px -8px rgba(0,0,0,0.5)",
                      }
                    : { color: TEXT_IDLE, border: "1px solid transparent" };

                  const linkInner = (
                    <Link
                      to={item.to}
                      aria-label={item.label}
                      className={`group relative flex items-center rounded-lg text-[13px] transition-all ${
                        collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-1.5"
                      }`}
                      style={idleStyle}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                          e.currentTarget.style.color = TEXT_HOVER;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = TEXT_IDLE;
                        }
                      }}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute -left-[1px] top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r"
                          style={{
                            background: "#d4b04a",
                            boxShadow: "0 0 8px rgba(152,120,20,0.6)",
                          }}
                        />
                      )}
                      <span className="relative flex items-center justify-center shrink-0">
                        <Icon
                          size={collapsed ? 18 : 15}
                          strokeWidth={1.7}
                          style={{ color: active ? TEXT_ACTIVE : ICON_IDLE }}
                        />
                        {/* No modo colapsado, contador vira um dot no canto do ícone */}
                        {collapsed && hasCount && (
                          <span
                            aria-hidden
                            className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full"
                            style={{ background: "#d4b04a", boxShadow: "0 0 0 2px #1a1c38" }}
                          />
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className={`flex-1 ${active ? "font-medium" : "font-normal"}`}>
                            {item.label}
                          </span>
                          {hasCount && (
                            <Badge
                              count={count}
                              tone={item.to === "/controladoria" ? "danger" : "neutral"}
                            />
                          )}
                        </>
                      )}
                    </Link>
                  );

                  return (
                    <li key={item.to}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{linkInner}</TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="bg-[#14162e] text-white border border-white/10"
                          >
                            {item.label}
                            {hasCount ? ` · ${count}` : ""}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        linkInner
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User */}
        <div
          className={
            collapsed
              ? "flex flex-col items-center gap-2 px-2 py-3"
              : "px-3 py-3 flex items-center gap-2.5"
          }
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11.5px] font-medium text-white shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #2a2c54, #14162e)",
                    border: "1px solid rgba(152,120,20,0.4)",
                  }}
                >
                  {initial}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-[#14162e] text-white border border-white/10"
              >
                {displayName} · {role ? ROLE_LABELS[role] : email || "Administrador"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-medium text-white shrink-0"
                style={{
                  background: "linear-gradient(135deg, #2a2c54, #14162e)",
                  border: "1px solid rgba(152,120,20,0.4)",
                }}
              >
                {initial}
              </div>
              <div className="flex-1 leading-tight min-w-0">
                <div className="text-[12.5px] font-medium truncate" style={{ color: GOLD_BRIGHT }}>
                  {displayName}
                </div>
                <div className="text-[10px] truncate" style={{ color: "rgba(233,205,132,0.6)" }}>
                  {role ? ROLE_LABELS[role] : email || "Administrador"}
                </div>
              </div>
            </>
          )}
          <button
            onClick={handleLogout}
            title="Sair"
            aria-label="Sair"
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: "rgba(232,232,232,0.6)" }}
          >
            <LogOut size={15} strokeWidth={1.7} />
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
