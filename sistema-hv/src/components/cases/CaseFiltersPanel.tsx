import { ChevronsUpDown, Filter, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import { TemaFieldDefsEditor } from "@/components/pipeline/TemaFieldDefsEditor";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";
import { fieldBag } from "@/lib/cases/tema-field-value";
import { usePodeEditar } from "@/hooks/usePermissions";
import {
  MACRO_FIN_LABELS,
  MACRO_OP_LABELS,
  type MacroFin,
  type MacroOp,
} from "@/lib/cases/constants";

// A2 (2026-08-05) — Filtros dinâmicos: cada campo aceita VALOR ÚNICO ou LISTA de
// valores. String (retrocompat: filtro de valor único ou input "contém"); array
// (multi-valor de seleção: "muito baixo" + "baixo" juntos → união/OR interno).
export type CanonicalFilters = Record<string, string | string[]>;

// R2-09 — sentinela para "listar só os casos com o campo EM BRANCO" (não
// preenchido). O usuário pediu poder "puxar os em branco" na lista.
export const CANONICAL_EMPTY = "__EMPTY__";

// A3 (2026-08-05) — teto de opções renderizadas num controle de seleção. Acima
// disso o controle degrada para input "Contém…" (busca textual), evitando um
// dropdown gigante (ex.: 5.000 municípios) que travaria a UI. Protege qualquer
// campo de alta cardinalidade, não só município.
export const FILTER_OPTIONS_CAP = 200;

// A2 (2026-08-05) — normaliza o valor de um filtro canônico para um conjunto de
// selecionados. string → [string]; undefined/"" → []; array → cópia sem vazios.
// Usado tanto na UI (multi-checkbox) quanto no matching (applyCaseFilters).
export function toSelectedSet(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v.filter((s) => s !== "" && s != null);
  if (typeof v === "string" && v !== "") return [v];
  return [];
}

// Converte centavos (armazenados p/ type=money) em rótulo R$ para o dropdown.
function moneyLabel(raw: string): string {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return raw;
  return (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type CaseFilterValues = {
  etapaOp: string;
  etapaFin: string;
  responsavel: string;
  municipio: string;
  frente: string;
  caso: string;
  canonical: CanonicalFilters;
};

const EMPTY_FILTERS: CaseFilterValues = {
  etapaOp: "",
  etapaFin: "",
  responsavel: "",
  municipio: "",
  frente: "",
  caso: "",
  canonical: {},
};

type CaseRow = {
  macrostatus_op?: string;
  macrostatus_fin?: string;
  responsavel?: string | null;
  municipio?: string | null;
  frente_slug?: string | null;
  caso_pasta_nome?: string | null;
  canonical_fields?: Record<string, unknown> | null;
  // #3 — custom_fields do cliente (anexado por listCases) p/ campos scope='cliente'.
  client_custom_fields?: Record<string, unknown> | null;
};

type Props = {
  temaId: string | null | undefined;
  cases: CaseRow[];
  filters: CaseFilterValues;
  onChange: (f: CaseFilterValues) => void;
  /** Frentes opcionais para o dropdown (label+slug) */
  frenteOptions?: { slug: string; label: string }[];
  /** Ocultar filtros fixos específicos */
  hideFixed?: ("etapaOp" | "etapaFin" | "responsavel" | "municipio" | "frente" | "caso")[];
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
  // Editor de filtros do tema (criar/ocultar/excluir os customizados). Só admin
  // e só quando há um tema selecionado (é onde os filtros vivem).
  const [editOpen, setEditOpen] = useState(false);
  // B3 (2026-08-05) — gate por MÓDULO (mesma régua do servidor
  // `requireModule('sistema','edit')`): honra overrides por usuário, não só admin.
  const podeGerirFiltros = usePodeEditar("sistema") && !!temaId;
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

  const casoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases) if (c.caso_pasta_nome) set.add(c.caso_pasta_nome);
    return Array.from(set).sort();
  }, [cases]);

  // R2-09 — Opções dinâmicas por field def, para TODOS os tipos. Cada entrada é
  // uma lista {value,label}: o `value` casa com canonical_fields; o `label` é o
  // que o usuário vê no dropdown. É AQUI que "as opções dos filtros aparecem":
  //   • select  → as opções definidas no tema;
  //   • boolean → Sim / Não;
  //   • money   → valores observados, formatados em R$;
  //   • demais  → valores distintos observados nos dados.
  const canonicalOptions = useMemo(() => {
    const map: Record<string, { value: string; label: string }[]> = {};
    for (const def of fieldDefs ?? []) {
      if (def.type === "boolean") {
        map[def.key] = [
          { value: "true", label: "Sim" },
          { value: "false", label: "Não" },
        ];
        continue;
      }
      if ((def.type === "select" || def.type === "multiselect") && Array.isArray(def.options)) {
        map[def.key] = (def.options as string[]).map((o) => ({ value: o, label: o }));
        continue;
      }
      // text / number / date / money (e select sem options) → derivar dos dados,
      // lendo da fonte certa por scope (#3) e achatando múltiplas ocorrências (#6).
      const set = new Set<string>();
      for (const c of cases) {
        const val = fieldBag(def, c)[def.key];
        if (val === null || val === undefined || val === "") continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            const s = String(item).trim();
            if (s) set.add(s);
          }
        } else {
          set.add(String(val).trim());
        }
      }
      if (set.size > 0) {
        map[def.key] = Array.from(set)
          .sort()
          .map((v) => ({ value: v, label: def.type === "money" ? moneyLabel(v) : v }));
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
    filters.caso ||
    Object.values(filters.canonical).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));

  function updateFixed<K extends keyof Omit<CaseFilterValues, "canonical">>(
    key: K,
    val: CaseFilterValues[K],
  ) {
    onChange({ ...filters, [key]: val });
  }

  // A2 — grava valor único (input "contém") OU lista (multi-checkbox). Lista
  // vazia é removida da key p/ manter `canonical` enxuto (default = todos).
  function updateCanonical(key: string, val: string | string[]) {
    const next = { ...filters.canonical };
    if (Array.isArray(val) && val.length === 0) {
      delete next[key];
    } else {
      next[key] = val;
    }
    onChange({ ...filters, canonical: next });
  }

  function clearAll() {
    onChange({ ...EMPTY_FILTERS });
  }

  // R2-09 — TODOS os campos definidos no tema viram filtro (select, Sim/Não,
  // data, número, valor, texto). Assim as opções que o admin criou aparecem.
  // A2 (2026-08-03): exceto os marcados com `hidden_in_filters` — seguem na ficha
  // e na coluna da lista, mas NÃO aparecem no painel de filtros (lista + Kanban).
  const filterableDefs = useMemo(
    () => (fieldDefs ?? []).filter((d) => !d.hidden_in_filters),
    [fieldDefs],
  );

  const hide = new Set(hideFixed);

  return (
    <div className="mb-4">
      {/* Toggle + botão de editar filtros do tema (admin) */}
      <div className="mb-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-[var(--navy)] transition-colors"
        >
          <Filter size={14} />
          {open ? "Ocultar filtros" : "Mostrar filtros"}
          {hasActiveFilters && (
            <span className="ml-1 w-2 h-2 rounded-full bg-[var(--gold)] inline-block" />
          )}
        </button>
        {podeGerirFiltros && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            title="Criar, ocultar ou excluir campos do tema"
            className="flex items-center gap-1.5 text-[13px] text-[var(--gold-700)] hover:text-[var(--gold)] transition-colors"
          >
            <SlidersHorizontal size={14} />
            Editar campos
          </button>
        )}
      </div>

      {/* Editor de filtros do tema — só os customizados (criar/editar/ocultar/
          excluir). Os filtros padrão do sistema (Caso, Financeiro, Responsável,
          Município) não são editáveis. */}
      {podeGerirFiltros && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Campos do tema</DialogTitle>
              <DialogDescription>
                Crie os campos personalizados deste tema (viram colunas na Lista e filtros de
                busca). Escolha se o valor é do caso ou do cliente, quantos preenchimentos aceita e
                se some da coluna da Lista. Os filtros padrão (Caso, Financeiro, Responsável,
                Município) não são editáveis.
              </DialogDescription>
            </DialogHeader>
            <TemaFieldDefsEditor
              temaId={temaId as string}
              frenteSlug={null}
              title="Campos personalizados"
            />
          </DialogContent>
        </Dialog>
      )}

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

            {!hide.has("caso") && casoOptions.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  Caso
                </label>
                <select
                  value={filters.caso}
                  onChange={(e) => updateFixed("caso", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Todos</option>
                  {casoOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
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

            {/* Filtros dinâmicos do tema (canonical field defs). A2: campos de
                seleção viram multi-checkbox (marca 1+ valores, união/OR). A3:
                acima do teto de opções (ou texto com muitos valores) degrada
                para busca "contém" (input de valor único). */}
            {filterableDefs.map((def) => {
              const opts = canonicalOptions[def.key] ?? [];
              // A3 — texto com muitas opções OU qualquer tipo acima do teto vira
              // input "Contém…" (evita dropdown gigante de alta cardinalidade).
              const useInput =
                (def.type === "text" && opts.length > 20) || opts.length > FILTER_OPTIONS_CAP;
              const raw = filters.canonical[def.key];
              const inputVal = typeof raw === "string" && raw !== CANONICAL_EMPTY ? raw : "";
              return (
                <div key={def.key}>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                    {def.label}
                  </label>
                  {useInput ? (
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => updateCanonical(def.key, e.target.value)}
                      placeholder="Contém..."
                      className={inputClass}
                    />
                  ) : (
                    <CanonicalFilterMultiSelect
                      options={opts}
                      value={toSelectedSet(raw)}
                      onChange={(next) => updateCanonical(def.key, next)}
                    />
                  )}
                </div>
              );
            })}
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

// A2 (2026-08-05) — Multi-checkbox de VALOR para um filtro canônico de seleção.
// Marca 1+ valores (união/OR interno). Inclui a pseudo-opção "(em branco)" =
// CANONICAL_EMPTY, mutuamente exclusiva com valores reais (não existe "vazio E
// igual a X"): marcar "(em branco)" limpa os reais e vice-versa. Rótulo do
// gatilho: "Todos" (nenhum) / "1 selecionado" / "N selecionados". Reusa o padrão
// visual de CanonicalMultiSelect (Popover + Checkbox), mas com {value,label}.
function CanonicalFilterMultiSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const selected = value;
  const emptySelected = selected.includes(CANONICAL_EMPTY);
  const label =
    selected.length === 0
      ? "Todos"
      : selected.length === 1
        ? emptySelected
          ? "(em branco)"
          : "1 selecionado"
        : `${selected.length} selecionados`;

  function toggle(val: string, checked: boolean) {
    if (val === CANONICAL_EMPTY) {
      // "(em branco)" é exclusivo: marcá-la limpa os valores reais.
      onChange(checked ? [CANONICAL_EMPTY] : []);
      return;
    }
    if (checked) {
      // marcar um valor real limpa "(em branco)".
      onChange([...selected.filter((s) => s !== CANONICAL_EMPTY), val]);
    } else {
      onChange(selected.filter((s) => s !== val));
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full items-center justify-between gap-2 py-2 px-3 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
        >
          <span className="truncate text-left">{label}</span>
          <ChevronsUpDown size={13} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-56 space-y-0.5 overflow-auto">
          <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--muted)]">
            <Checkbox
              checked={emptySelected}
              onCheckedChange={(c) => toggle(CANONICAL_EMPTY, c === true)}
            />
            <span className="text-muted-foreground">(em branco)</span>
          </label>
          {options.length === 0 ? (
            <div className="px-1 text-xs text-muted-foreground">Sem opções.</div>
          ) : (
            options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--muted)]"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => toggle(opt.value, c === true)}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Aplica os filtros sobre uma lista de cases. Retorna o subconjunto filtrado.
 *
 * R2-09 — `defs` (opcional) traz o tipo de cada campo do tema para decidir o
 * matching dos filtros canônicos: campos de DROPDOWN (select/boolean/date/
 * number/money) casam por IGUALDADE exata (evita falso-positivo tipo "Inativo"
 * contendo "Ativo"); campos de TEXTO casam por "contém". O valor sentinela
 * CANONICAL_EMPTY mantém só os casos com o campo EM BRANCO. Sem `defs`
 * (compat), mantém o comportamento antigo de "contém".
 */
export function applyCaseFilters<T extends CaseRow>(
  rows: T[],
  filters: CaseFilterValues,
  defs?: { key: string; type: string; scope?: string | null }[],
): T[] {
  const typeByKey = new Map((defs ?? []).map((d) => [d.key, d.type]));
  const scopeByKey = new Map((defs ?? []).map((d) => [d.key, d.scope ?? "caso"]));
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
    if (filters.caso && (c.caso_pasta_nome ?? "") !== filters.caso) return false;
    // Filtros canônicos (campos dinâmicos do tema).
    // A2 (2026-08-05): o valor do filtro é um CONJUNTO de selecionados (OR interno
    // entre os valores do MESMO campo); campos diferentes seguem combinando por
    // AND (o `for` já é AND — todo campo precisa passar).
    for (const [key, val] of Object.entries(filters.canonical)) {
      const selected = toSelectedSet(val);
      if (selected.length === 0) continue;
      const wantsEmpty = selected.includes(CANONICAL_EMPTY);
      // Valores reais (sem o sentinela) em lower-case p/ comparação.
      const realSel = selected.filter((s) => s !== CANONICAL_EMPTY);
      const realLower = realSel.map((s) => s.toLowerCase());
      // #3 — lê da fonte certa: campo do cliente vem de client_custom_fields.
      const bag =
        scopeByKey.get(key) === "cliente"
          ? (c.client_custom_fields ?? {})
          : (c.canonical_fields ?? {});
      const rawVal = bag[key];
      // Múltipla escolha do CASO: valor é ARRAY — casa se INTERSETA o conjunto
      // selecionado; "(em branco)" casa quando o array está vazio.
      if (Array.isArray(rawVal)) {
        const empty = rawVal.length === 0;
        if (wantsEmpty && empty) continue;
        const arr = rawVal.map((x) => String(x).toLowerCase());
        if (realLower.some((s) => arr.includes(s))) continue;
        return false;
      }
      const cVal = rawVal === null || rawVal === undefined ? "" : String(rawVal);
      const isEmpty = cVal.trim() === "";
      // "(em branco)" (OR): mantém se o campo está vazio.
      if (wantsEmpty && isEmpty) continue;
      const cLower = cVal.toLowerCase();
      const type = typeByKey.get(key);
      // Texto (ou sem defs) → "contém algum" termo; demais (dropdown) → valor ∈ S.
      const hit =
        type === undefined || type === "text"
          ? realLower.some((s) => cLower.includes(s))
          : realLower.includes(cLower);
      if (!hit) return false;
    }
    return true;
  });
}
