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
  Library,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  FileSignature,
  UserPlus,
  Receipt,
  ShieldCheck,
  GitBranch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signOut, useAuth } from "@/lib/auth";
import { useCasesList, useComercialCases } from "@/hooks/useCases";
import { useAllTasks } from "@/hooks/useDossie";
import { useExceptions } from "@/hooks/useExceptions";
import { canSeeRouteEfetiva, ROLE_LABELS } from "@/lib/rbac";
import { useMyModulePerms } from "@/hooks/usePermissions";

// Monograma H·V oficial (SVG) — copiado da referência de design v3 (hvmark).
function HvMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="28" height="24" viewBox="0 0 57 48" aria-hidden>
      <defs>
        <linearGradient id="hvGoldMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D3AE60" />
          <stop offset="1" stopColor="#8A672A" />
        </linearGradient>
      </defs>
      <rect x="0" y="4" width="7" height="40" fill="url(#hvGoldMark)" />
      <rect x="11" y="30" width="7" height="7" fill="url(#hvGoldMark)" />
      <rect x="22" y="4" width="7" height="40" fill="url(#hvGoldMark)" />
      <polygon points="29,4 50,44 43,44 29,17" fill="url(#hvGoldMark)" />
      <polygon points="43,4 57,4 50,17" fill="url(#hvGoldMark)" />
      <rect x="50" y="4" width="7" height="40" fill="url(#hvGoldMark)" />
    </svg>
  );
}

const COLLAPSE_KEY = "hv:sidebar-collapsed";

// Paleta de leitura sobre o navy #1e2044 — gold CLARO/luminoso (champanhe) p/ o
// TEXTO e ícones, igual ao tom da topbar (contraste AA folgado, ~9:1). O gold
// escuro #987814 fica reservado só pra preenchimentos/acentos sólidos.
const GOLD_BRIGHT = "#e9cd84";
// Texto do menu no padrão v3: idle taupe quente, hover creme, ativo creme-claro.
const TEXT_IDLE = "#a9a292";
const TEXT_HOVER = "#e7e2d3";
const TEXT_ACTIVE = "#f6f1e2";
const ICON_IDLE = "rgba(169,162,146,0.9)";
const GROUP_LABEL = "rgba(198,161,85,0.55)";

type BadgeTone = "neutral" | "gold" | "danger";
type Item = { to: string; label: string; icon: LucideIcon; count?: number; tone?: BadgeTone };

// Reorganização das abas (2026-07-09, item 5).
const groups: { label: string; items: Item[] }[] = [
  {
    label: "Operação",
    items: [
      { to: "/hoje", label: "Hoje", icon: Home },
      { to: "/pipeline", label: "Pipeline Operacional", icon: Briefcase },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/comercial/assinaturas", label: "Assinatura", icon: FileSignature, tone: "gold" },
      { to: "/tarefas", label: "Tarefas", icon: CheckSquare },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/inteligencia/leads", label: "Cadastro", icon: UserPlus },
      { to: "/comercial", label: "Comercial", icon: TrendingUp },
      { to: "/comercial/leads", label: "Pipeline Comercial", icon: LayoutGrid },
    ],
  },
  // Financeiro (2026-07-19) — grupo próprio entre Comercial e Inteligência. As
  // sub-abas Cobranças e Inadimplência continuam dentro da Pipeline Financeira.
  {
    label: "Financeiro",
    items: [
      { to: "/casos/financeiro", label: "Pipeline Financeira", icon: DollarSign },
      { to: "/relatorio-financeiro", label: "Relatório Financeiro", icon: Receipt },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { to: "/controladoria", label: "Controladoria", icon: Scale },
      { to: "/controladoria/distribuicao", label: "Distribuição", icon: GitBranch },
      { to: "/peticionamento", label: "Peticionamento", icon: FileText },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/dashboards", label: "Dashboard", icon: BarChart3 },
    ],
  },
  {
    label: "Marketing",
    items: [
      { to: "/marketing", label: "Marketing", icon: Megaphone },
      { to: "/design-system", label: "Design System", icon: Palette },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/referencias", label: "Referências", icon: Library },
      { to: "/permissoes", label: "Permissões", icon: ShieldCheck },
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
  const { data: perms } = useMyModulePerms();
  const { data: casos } = useCasesList();
  // ITEM 1 (2026-07-07) — o badge de "Assinaturas" deve refletir EXATAMENTE a
  // lista da aba (casos cujo documento foi enviado ao ZapSign), não todo caso com
  // aguardando_assinatura_at (que era carimbado antes do envio → badge "1"
  // fantasma). Fonte única: useComercialCases (mesma de comercial/assinaturas).
  const { data: comercialCases } = useComercialCases();
  const { data: tasks } = useAllTasks();
  const { total: excTotal } = useExceptions();

  // Contadores REAIS (Supabase): casos, bifurcados na financeira e tarefas abertas.
  const realCounts: Record<string, number> = {};
  if (casos) {
    realCounts["/casos"] = casos.length;
    // Pipeline Operacional: conta só o que o Kanban operacional mostra — exclui
    // casos em fase comercial (aguardando assinatura) e os removidos do op. Sem
    // isso, um lead recém-vinculado a um caso já pontuava "1" sem card na coluna.
    realCounts["/pipeline"] = casos.filter(
      (c) =>
        !(c as { aguardando_assinatura_at?: string | null }).aguardando_assinatura_at &&
        !(c as { removido_do_operacional_at?: string | null }).removido_do_operacional_at,
    ).length;
    realCounts["/casos/financeiro"] = casos.filter(
      (c) => c.macrostatus_fin !== "NAO_APLICAVEL",
    ).length;
  }
  if (comercialCases && comercialCases.length > 0) {
    realCounts["/comercial/assinaturas"] = comercialCases.length;
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
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (it) =>
              // Respeita os OVERRIDES por aba (não-ver/visualizar/editar), não só o
              // papel base. "Não ver" numa aba some do menu.
              canSeeRouteEfetiva(role, perms ?? {}, it.to) &&
              // Permissões é exclusivo do admin (mesmo papéis "all" não veem).
              (it.to !== "/permissoes" || role === "admin"),
          ),
        }))
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
          width: collapsed ? 72 : 256,
          transition: "width var(--hv-dur-base) var(--hv-ease-out)",
          background: "var(--hv-sidebar-grad)",
          boxShadow: "inset -1px 0 0 rgba(198,161,85,0.14), 4px 0 24px -8px rgba(10,16,31,0.35)",
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
            <HvMark className="shrink-0" />
            {!collapsed && (
              <>
                <span
                  className="w-px h-7 shrink-0"
                  style={{ background: "rgba(198,161,85,0.4)" }}
                />
                <div className="leading-tight">
                  <div
                    className="font-brand text-[13px] text-white"
                    style={{ letterSpacing: "0.14em" }}
                  >
                    HYAGOVIANA
                  </div>
                  <div
                    className="text-[6.5px] font-semibold uppercase"
                    style={{ color: "rgba(233,205,132,0.85)", letterSpacing: "0.5em" }}
                  >
                    Advocacia
                  </div>
                </div>
              </>
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
                  className="px-3 mb-2 text-[9px] uppercase font-semibold"
                  style={{ color: GROUP_LABEL, letterSpacing: "0.28em" }}
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
                        background:
                          "linear-gradient(90deg, rgba(198,161,85,0.17), rgba(198,161,85,0.03))",
                        boxShadow: "inset 0 0 0 1px rgba(198,161,85,0.14)",
                        color: TEXT_ACTIVE,
                        border: "1px solid transparent",
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
                          className="absolute -left-[1px] top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r"
                          style={{
                            background: "var(--hv-gold-soft)",
                            boxShadow: "0 0 10px rgba(198,161,85,0.55)",
                          }}
                        />
                      )}
                      <span className="relative flex items-center justify-center shrink-0">
                        <Icon
                          size={collapsed ? 18 : 15}
                          strokeWidth={1.7}
                          style={{ color: active ? "var(--hv-gold-soft)" : ICON_IDLE }}
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
