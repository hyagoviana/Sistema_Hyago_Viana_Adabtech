import { useRouterState } from "@tanstack/react-router";
import { Search, Plus, Filter, Bell, ChevronDown } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/lib/auth";

const labelMap: Record<string, string> = {
  hoje: "Hoje",
  casos: "Casos",
  financeiro: "Financeiro",
  clientes: "Clientes",
  tarefas: "Tarefas",
  controladoria: "Controladoria",
  peticionamento: "Peticionamento",
  comercial: "Comercial",
  marketing: "Marketing",
  whatsapp: "WhatsApp",
  dashboards: "Dashboards",
  configuracoes: "Configurações",
  "design-system": "Design System",
  inadimplencia: "Inadimplência",
  lista: "Lista",
};

export function Topbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const segs = path.split("/").filter(Boolean);
  const crumbs = ["Painel", ...segs.map((s) => labelMap[s] ?? s)];
  const [openNew, setOpenNew] = useState(false);
  const { session } = useAuth();
  const email = session?.user?.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 px-6"
      style={{
        height: 56,
        background: "#f8f7f3",
        borderBottom: "1px solid rgba(120,96,30,0.10)",
        boxShadow: "0 1px 2px rgba(60,50,20,0.04)",
      }}
    >
      <nav className="flex items-center gap-1.5 text-[12px] text-[var(--ink-400)] min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[var(--ink-300)]">/</span>}
            <span className={i === crumbs.length - 1 ? "text-[#1a1a1f] font-medium" : ""}>
              {c}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2 w-full max-w-md h-9 px-3 rounded-lg bg-[#edece8] border border-[rgba(80,70,45,0.12)] transition-shadow focus-within:border-[var(--gold)] focus-within:shadow-[0_0_0_3px_var(--ring)]">
          <Search size={14} className="text-[var(--ink-400)]" strokeWidth={1.6} />
          <input
            type="text"
            placeholder="Buscar caso, cliente, documento…"
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-[var(--ink-400)]"
          />
          <kbd className="text-[10px] font-mono text-[var(--ink-400)] px-1.5 py-0.5 rounded border border-[var(--border)] bg-white">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative">
          <button
            onClick={() => setOpenNew((v) => !v)}
            onBlur={() => setTimeout(() => setOpenNew(false), 150)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12.5px] font-medium transition-all hover:-translate-y-px"
            style={{
              background: "linear-gradient(180deg, #a98a22 0%, #987814 60%, #856611 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 16px -8px rgba(152,120,20,0.5)",
            }}
          >
            <Plus size={13} strokeWidth={2} />
            Novo
            <ChevronDown size={12} strokeWidth={2} />
          </button>
          {openNew && (
            <div
              className="absolute right-0 top-9 w-44 rounded-xl py-1 z-50"
              style={{
                background: "var(--card)",
                border: "1px solid rgba(120,96,30,0.14)",
                boxShadow: "0 12px 28px -10px rgba(60,50,20,0.22)",
              }}
            >
              {["Caso", "Cliente", "Tarefa", "Lead", "Documento"].map((it) => (
                <button
                  key={it}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-[#1a1a1f] hover:bg-[var(--ink-50)]"
                >
                  {it}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-500)] hover:bg-[var(--ink-50)] hover:text-[#1a1a1f]"
          title="Filtros"
        >
          <Filter size={14} strokeWidth={1.6} />
        </button>

        <button
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-500)] hover:bg-[var(--ink-50)] hover:text-[#1a1a1f]"
          title="Notificações"
        >
          <Bell size={14} strokeWidth={1.6} />
        </button>

        <div className="w-px h-5 mx-1 bg-[var(--border)]" />

        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium text-white"
          style={{ background: "#1e2044" }}
          title={email || "Usuário"}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
