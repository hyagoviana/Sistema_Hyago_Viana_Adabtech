import { useRouterState } from "@tanstack/react-router";
import { Search, Plus, Filter, Bell, ChevronDown } from "lucide-react";
import { useState } from "react";

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

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 px-6 glass-panel"
      style={{ height: 52, borderBottom: "1px solid var(--border)" }}
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
        <div
          className="flex items-center gap-2 w-full max-w-md h-8 px-3 rounded-lg bg-white/60"
          style={{ border: "1px solid var(--border)" }}
        >
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
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-[#987814] text-white text-[12.5px] font-medium hover:bg-[var(--gold-700)] transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            Novo
            <ChevronDown size={12} strokeWidth={2} />
          </button>
          {openNew && (
            <div
              className="absolute right-0 top-9 w-44 bg-white rounded-xl py-1 z-50"
              style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
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
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
        </button>

        <button
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-500)] hover:bg-[var(--ink-50)] hover:text-[#1a1a1f]"
          title="Notificações"
        >
          <Bell size={14} strokeWidth={1.6} />
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9.5px] font-semibold text-white flex items-center justify-center"
            style={{ background: "var(--danger)" }}
          >
            3
          </span>
        </button>

        <div className="w-px h-5 mx-1 bg-[var(--border)]" />

        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium text-white"
          style={{ background: "#1e2044" }}
          title="Maria Souza"
        >
          M
        </div>
      </div>
    </header>
  );
}
