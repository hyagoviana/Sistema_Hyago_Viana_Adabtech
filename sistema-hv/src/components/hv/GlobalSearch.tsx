import { useNavigate } from "@tanstack/react-router";
import { Search, Briefcase, Users, FileText, Tag, LayoutGrid, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import type { SearchResultType } from "@/lib/search-service";

const ICON: Record<SearchResultType, LucideIcon> = {
  caso: Briefcase,
  cliente: Users,
  documento: FileText,
  tema: Tag,
  pagina: LayoutGrid,
};
const TYPE_LABEL: Record<SearchResultType, string> = {
  caso: "Caso",
  cliente: "Cliente",
  documento: "Documento",
  tema: "Tema",
  pagina: "Página",
};

// Busca GLOBAL da topbar (lupa "Buscar caso, cliente, documento…"). Pesquisa em
// casos, clientes e documentos; o resultado abre a ficha correspondente.
export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: results, isFetching } = useGlobalSearch(q);
  const containerRef = useRef<HTMLDivElement>(null);

  const show = open && q.trim().length >= 2;

  function go(to: string) {
    setOpen(false);
    setQ("");
    // Rotas dinâmicas (/casos/:id, /clientes/:id) — navegação por string.
    navigate({ to });
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-md"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[#edece8] border border-[rgba(80,70,45,0.12)] transition-shadow focus-within:border-[var(--gold)] focus-within:shadow-[0_0_0_3px_var(--ring)]">
        <Search size={14} className="text-[var(--ink-400)]" strokeWidth={1.6} />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Buscar caso, cliente, documento…"
          className="flex-1 bg-transparent outline-none text-[13px] font-medium text-[#1a1a1f] placeholder:text-[var(--ink-400)] placeholder:font-medium"
        />
        {isFetching ? (
          <Loader2 size={13} className="animate-spin text-[var(--ink-400)]" />
        ) : (
          <kbd className="text-[10px] font-mono text-[var(--ink-400)] px-1.5 py-0.5 rounded border border-[var(--border)] bg-white">
            ⌘K
          </kbd>
        )}
      </div>

      {show && (
        <div
          className="absolute left-0 right-0 top-11 rounded-xl py-1.5 z-50 max-h-[70vh] overflow-y-auto"
          style={{
            background: "var(--card)",
            border: "1px solid rgba(120,96,30,0.14)",
            boxShadow: "0 12px 28px -10px rgba(60,50,20,0.22)",
          }}
        >
          {isFetching && (!results || results.length === 0) ? (
            <div className="px-3 py-3 text-[13px] text-[var(--ink-400)]">Buscando…</div>
          ) : !results || results.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-[var(--ink-400)]">
              Nada encontrado para “{q.trim()}”.
            </div>
          ) : (
            results.map((r) => {
              const Icon = ICON[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(r.to);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--ink-50)]"
                >
                  <Icon size={15} className="text-[var(--gold-700)] shrink-0" strokeWidth={1.7} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[#1a1a1f] truncate">
                      {r.label}
                      <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-400)] font-normal">
                        {TYPE_LABEL[r.type]}
                      </span>
                    </div>
                    {r.sublabel && (
                      <div className="text-[11.5px] text-[var(--ink-400)] truncate">
                        {r.sublabel}
                      </div>
                    )}
                  </div>
                  {/* Ramificação — onde a busca leva. */}
                  <span className="text-[10.5px] text-[var(--ink-400)] shrink-0 text-right max-w-[140px] truncate">
                    {r.ramificacao} ›
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
