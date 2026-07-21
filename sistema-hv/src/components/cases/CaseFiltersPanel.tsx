import { Filter, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";
import {
  MACRO_FIN_LABELS,
  MACRO_OP_LABELS,
  type MacroFin,
  type MacroOp,
} from "@/lib/cases/constants";

// Filtros dinâmicos: { [fieldKey]: valor selecionado }
export type CanonicalFilters = Record<string, string>;

export type CaseFilterValues = {
  etapaOp: string;
  etapaFin: string;
  responsavel: string;
  municipio: string;
  frente: string;
  canonical: CanonicalFilters;
};

const EMPTY_FILTERS: CaseFilterValues = {
  etapaOp: "",
  etapaFin: "",
  responsavel: "",
  municipio: "",
  frente: "",
  canonical: {},
};

type CaseRow = {
  macrostatus_op?: string;
  macrostatus_fin?: string;
  responsavel?: string | null;
  municipio?: string | null;
  frente_slug?: string | null;
  canonical_fields?: Record<string, unknown> | null;
};

type Props = {
  temaId: string | null | undefined;
  cases: CaseRow[];
  filters: CaseFilterValues;
  onChange: (f: CaseFilterValues) => void;
  /** Frentes opcionais para o dropdown (label+slug) */
  frenteOptions?: { slug: string; label: string }[];
  /** Ocultar filtros fixos específicos */
  hideFixed?: ("etapaOp" | "etapaFin" | "responsavel" | "municipio" | "frente")[];
};

const selectClass =
  "w-full py-2 px-3 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none";
const inputClass = selectClass;

export function CaseFiltersPanel({
  temaId,
  cases,
  filters,
  onChange,
  frenteOptions,
  hideFixed = [],
}: Props) {
  const [open, setOpen] = useState(true);
  const { data: fieldDefs } = useTemaFieldDefs(temaId);

  // Opções derivadas dos dados para filtros fixos
  const etapaOpOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases) if (c.macrostatus_op) set.add(c.macrostatus_op);
    return Array.from(set)
      .map((s) => ({ value: s, label: MACRO_OP_LABELS[s as MacroOp] ?? s }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cases]);

  const etapaFinOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases)
      if (c.macrostatus_fin && c.macrostatus_fin !== "NAO_APLICAVEL") set.add(c.macrostatus_fin);
    return Array.from(set)
      .map((s) => ({ value: s, label: MACRO_FIN_LABELS[s as MacroFin] ?? s }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cases]);

  const responsavelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases) if (c.responsavel) set.add(c.responsavel);
    return Array.from(set).sort();
  }, [cases]);

  const municipioOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases) if (c.municipio) set.add(c.municipio);
    return Array.from(set).sort();
  }, [cases]);

  // Opções dinâmicas do canonical_fields para cada field def (tipo select)
  const canonicalOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const def of fieldDefs ?? []) {
      if (def.type === "select" && Array.isArray(def.options)) {
        map[def.key] = def.options as string[];
      } else if (def.type === "text" || def.type === "select") {
        // Para text sem opções pré-definidas, extrair dos dados
        const set = new Set<string>();
        for (const c of cases) {
          const val = (c.canonical_fields ?? {})[def.key];
          if (typeof val === "string" && val.trim()) set.add(val.trim());
        }
        if (set.size > 0) map[def.key] = Array.from(set).sort();
      }
    }
    return map;
  }, [fieldDefs, cases]);

  const hasActiveFilters =
    filters.etapaOp ||
    filters.etapaFin ||
    filters.responsavel ||
    filters.municipio ||
    filters.frente ||
    Object.values(filters.canonical).some((v) => !!v);

  function updateFixed<K extends keyof Omit<CaseFilterValues, "canonical">>(
    key: K,
    val: CaseFilterValues[K],
  ) {
    onChange({ ...filters, [key]: val });
  }

  function updateCanonical(key: string, val: string) {
    onChange({ ...filters, canonical: { ...filters.canonical, [key]: val } });
  }

  function clearAll() {
    onChange({ ...EMPTY_FILTERS });
  }

  // Filtra field defs que fazem sentido como filtro (select e text com opções)
  const filterableDefs = useMemo(
    () =>
      (fieldDefs ?? []).filter(
        (d) => d.type === "select" || (d.type === "text" && (canonicalOptions[d.key]?.length ?? 0) > 0),
      ),
    [fieldDefs, canonicalOptions],
  );

  const hide = new Set(hideFixed);

  return (
    <div className="mb-4">
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-[var(--navy)] transition-colors mb-2"
      >
        <Filter size={14} />
        {open ? "Ocultar filtros" : "Mostrar filtros"}
        {hasActiveFilters && (
          <span className="ml-1 w-2 h-2 rounded-full bg-[var(--gold)] inline-block" />
        )}
      </button>

      {open && (
        <div className="card-editorial !p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-3">
            {/* Filtros fixos */}
            {!hide.has("etapaOp") && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  Etapa
                </label>
                <select
                  value={filters.etapaOp}
                  onChange={(e) => updateFixed("etapaOp", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Todos</option>
                  {etapaOpOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!hide.has("etapaFin") && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  Financeiro
                </label>
                <select
                  value={filters.etapaFin}
                  onChange={(e) => updateFixed("etapaFin", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Todos</option>
                  {etapaFinOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!hide.has("frente") && (frenteOptions ?? []).length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  Frente
                </label>
                <select
                  value={filters.frente}
                  onChange={(e) => updateFixed("frente", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Todas</option>
                  {(frenteOptions ?? []).map((fr) => (
                    <option key={fr.slug} value={fr.slug}>
                      {fr.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!hide.has("responsavel") && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  Responsável
                </label>
                <select
                  value={filters.responsavel}
                  onChange={(e) => updateFixed("responsavel", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Todos</option>
                  {responsavelOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!hide.has("municipio") && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  Município
                </label>
                {municipioOptions.length > 20 ? (
                  <input
                    type="text"
                    value={filters.municipio}
                    onChange={(e) => updateFixed("municipio", e.target.value)}
                    placeholder="Contém..."
                    className={inputClass}
                  />
                ) : (
                  <select
                    value={filters.municipio}
                    onChange={(e) => updateFixed("municipio", e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Todos</option>
                    {municipioOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Filtros dinâmicos do tema (canonical field defs) */}
            {filterableDefs.map((def) => (
              <div key={def.key}>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  {def.label}
                </label>
                {(canonicalOptions[def.key]?.length ?? 0) > 20 && def.type === "text" ? (
                  <input
                    type="text"
                    value={filters.canonical[def.key] ?? ""}
                    onChange={(e) => updateCanonical(def.key, e.target.value)}
                    placeholder="Contém..."
                    className={inputClass}
                  />
                ) : (
                  <select
                    value={filters.canonical[def.key] ?? ""}
                    onChange={(e) => updateCanonical(def.key, e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Todos</option>
                    {(canonicalOptions[def.key] ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          {/* Limpar filtros */}
          {hasActiveFilters && (
            <div className="flex justify-end mt-3 pt-2 border-t border-[rgba(120,96,30,0.08)]">
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-[12px] text-[var(--gold-700)] hover:text-[var(--gold)] transition-colors"
              >
                <X size={12} />
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Aplica os filtros sobre uma lista de cases. Retorna o subconjunto filtrado. */
export function applyCaseFilters<T extends CaseRow>(rows: T[], filters: CaseFilterValues): T[] {
  return rows.filter((c) => {
    if (filters.etapaOp && c.macrostatus_op !== filters.etapaOp) return false;
    if (filters.etapaFin && c.macrostatus_fin !== filters.etapaFin) return false;
    if (filters.responsavel && (c.responsavel ?? "") !== filters.responsavel) return false;
    // Município: suporte a busca parcial quando há muitos valores
    if (filters.municipio) {
      const mun = (c.municipio ?? "").toLowerCase();
      if (!mun.includes(filters.municipio.toLowerCase())) return false;
    }
    if (filters.frente && (c.frente_slug ?? "") !== filters.frente) return false;
    // Filtros canônicos (campos dinâmicos do tema)
    for (const [key, val] of Object.entries(filters.canonical)) {
      if (!val) continue;
      const cVal = String((c.canonical_fields ?? {})[key] ?? "");
      if (!cVal.toLowerCase().includes(val.toLowerCase())) return false;
    }
    return true;
  });
}
