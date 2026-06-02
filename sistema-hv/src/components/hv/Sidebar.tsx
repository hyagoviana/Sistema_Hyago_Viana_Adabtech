import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home, Briefcase, DollarSign, Users, CheckSquare, Scale, FileText,
  TrendingUp, Megaphone, MessageCircle, BarChart3, Palette, Settings, LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { signOut, useAuth } from "@/lib/auth";
import { canSeeRoute, ROLE_LABELS } from "@/lib/rbac";
import symbolHV from "@/assets/symbol-hv.png";

type BadgeTone = "neutral" | "gold" | "danger";
type Item = { to: string; label: string; icon: LucideIcon; count?: number; tone?: BadgeTone };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Operação",
    items: [
      { to: "/hoje", label: "Hoje", icon: Home },
      { to: "/casos", label: "Pipeline Operacional", icon: Briefcase, count: 487, tone: "neutral" },
      { to: "/casos/financeiro", label: "Pipeline Financeira", icon: DollarSign, count: 156, tone: "neutral" },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/tarefas", label: "Tarefas", icon: CheckSquare, count: 23, tone: "danger" },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { to: "/controladoria", label: "Controladoria", icon: Scale, count: 6, tone: "danger" },
      { to: "/peticionamento", label: "Peticionamento", icon: FileText },
      { to: "/comercial", label: "Comercial", icon: TrendingUp, count: 4, tone: "neutral" },
      { to: "/marketing", label: "Marketing", icon: Megaphone },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle, count: 12, tone: "gold" },
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

  // Apenas o item MAIS específico fica ativo: entre os que casam com o path,
  // vence o de maior comprimento (ex.: /casos/financeiro vence /casos), evitando
  // que Pipeline Operacional e Financeira acendam juntas.
  const activeTo = groups
    .flatMap((g) => g.items)
    .filter((it) => path === it.to || path.startsWith(it.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;

  const { session, role } = useAuth();
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
    <aside
      className="hidden lg:flex flex-col w-[228px] shrink-0 sticky top-0 h-screen text-white"
      style={{
        background:
          "linear-gradient(180deg, #1e2044 0%, #181a33 60%, #14162e 100%)",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        boxShadow:
          "1px 0 0 rgba(0,0,0,0.4), 6px 0 24px -8px rgba(0,0,0,0.35)",
      }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <Link to="/hoje" className="flex items-center gap-2.5">
          <img
            src={symbolHV}
            alt=""
            className="h-7 w-auto object-contain shrink-0"
          />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white tracking-tight">Hyago Viana</div>
            <div
              className="text-[9.5px] font-medium uppercase"
              style={{ color: "#987814", letterSpacing: "0.22em" }}
            >
              Advocacia
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-4">
        {visibleGroups.map((g, idx) => (
          <div
            key={g.label}
            className={idx === 0 ? "" : "mt-4 pt-4"}
            style={idx === 0 ? undefined : { borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div
              className="px-3 mb-2 text-[10.5px] uppercase font-semibold"
              style={{ color: "rgba(232,232,232,0.45)", letterSpacing: "0.16em" }}
            >
              {g.label}
            </div>
            <ul className="space-y-[2px]">
              {g.items.map((item) => {
                const active = item.to === activeTo;
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group relative flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all"
                      style={
                        active
                          ? {
                              background: "rgba(152,120,20,0.12)",
                              border: "1px solid rgba(152,120,20,0.22)",
                              color: "#ffffff",
                              boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 14px -8px rgba(0,0,0,0.5)",
                            }
                          : {
                              color: "rgba(232,232,232,0.7)",
                              border: "1px solid transparent",
                            }
                      }
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                          e.currentTarget.style.color = "#ffffff";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "rgba(232,232,232,0.7)";
                        }
                      }}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute -left-[1px] top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r"
                          style={{
                            background: "#987814",
                            boxShadow: "0 0 8px rgba(152,120,20,0.6)",
                          }}
                        />
                      )}
                      <Icon
                        size={15}
                        strokeWidth={1.7}
                        style={{ color: active ? "#d4b04a" : "rgba(232,232,232,0.55)" }}
                      />
                      <span className={`flex-1 ${active ? "font-medium" : "font-normal"}`}>
                        {item.label}
                      </span>
                      {item.count !== undefined && <Badge count={item.count} tone={item.tone} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div
        className="px-3 py-3 flex items-center gap-2.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
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
          <div className="text-[12.5px] text-white font-medium truncate">{displayName}</div>
          <div className="text-[10px] truncate" style={{ color: "rgba(232,232,232,0.45)" }}>
            {role ? ROLE_LABELS[role] : email || "Administrador"}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sair"
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: "rgba(232,232,232,0.6)" }}
        >
          <LogOut size={15} strokeWidth={1.7} />
        </button>
      </div>
    </aside>
  );
}
