import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpDown, ChevronDown, ChevronUp, LayoutGrid, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import {
  CaseFiltersPanel,
  applyCaseFilters,
  type CaseFilterValues,
} from "@/components/cases/CaseFiltersPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { useMyModulePerms, useMyModuleValues } from "@/hooks/usePermissions";
import { useFrentes, useTemas } from "@/hooks/useTemas";
import { useAuth } from "@/lib/auth";
import { podeVerValores } from "@/lib/rbac";
import {
  CASE_TYPE_LABELS,
  MACRO_FIN_LABELS,
  MACRO_OP_LABELS,
  type CaseType,
  type MacroFin,
  type MacroOp,
} from "@/lib/cases/constants";

// R2-08 — a Lista aceita ?cat= (categoria/service_type do Kanban), ?tema= e
// ?frente= (vindos do toggle "Ver em lista") para pré-filtrar. Search params
// tipados (mesmo padrão de pipeline.tsx). `cat` é o service_type_id da esteira
// aberta; `tema` agrupa por system_temas; `frente` semeia o chip de frente.
const searchSchema = z.object({
  cat: z.string().uuid().optional().catch(undefined),
  catName: z.string().optional().catch(undefined),
  tema: z.string().uuid().optional().catch(undefined),
  frente: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/casos/lista")({
  component: CasosLista,
  validateSearch: (search) => searchSchema.parse(search),
});

const PAGE_SIZE = 50;

function fmtBRL(centavos: number | null): string {
  if (centavos === null || centavos === undefined) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

// R2-08 — linha "achatada" para a Lista Excel: campos densos derivados uma vez
// (labels resolvidos) para ordenar/renderizar sem recalcular por célula.
type CaseRow = {
  id: string;
  case_code: string;
  client_name: string;
  case_type: string;
  service_type_id: string | null;
  tema_id: string | null;
  frente_slug: string | null;
  macrostatus_op: string;
  macrostatus_fin: string;
  municipio: string | null;
  valor_centavos: number | null;
  responsavel: string | null;
  created_at: string | null;
  canonical_fields: Record<string, unknown> | null;
};

// Colunas ordenáveis. `valor` só existe quando o gate financeiro permite.
type SortKey =
  | "case_code"
  | "client_name"
  | "case_type"
  | "tema"
  | "frente_slug"
  | "macrostatus_op"
  | "macrostatus_fin"
  | "responsavel"
  | "municipio"
  | "valor_centavos"
  | "created_at";

type SortDir = "asc" | "desc";

function CasosLista() {
  const { cat, catName, tema, frente } = Route.useSearch();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  // Tema selecionado (seed do search param ou dropdown).
  const [temaFilter, setTemaFilter] = useState<string>(tema ?? "");
  // Painel de filtros dinâmicos (fixos + canonical do tema).
  const [panelFilters, setPanelFilters] = useState<CaseFilterValues>({
    etapaOp: "",
    etapaFin: "",
    responsavel: "",
    municipio: "",
    frente: frente ?? "",
    canonical: {},
  });
  // Ordenação por coluna (default: mais recentes primeiro, como o servidor já
  // devolve por created_at desc).
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, isError, error } = useCasesList();
  const { data: temas } = useTemas();
  const { data: frentes } = useFrentes(temaFilter || null);

  // R4-01 / R2-08 (AC-4) — a coluna "valor" só aparece sob gate financeiro.
  // Único booleano trocável; overrides por usuário via permissaoEfetiva. Com a
  // tabela de overrides vazia é IDÊNTICO ao papel (regressão zero).
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  const { data: values } = useMyModuleValues();
  const podeVerValor = podeVerValores(role, perms ?? {}, values ?? {}, "financeiro");

  // Mapa id→nome de tema para exibir a coluna Tema e ordenar por rótulo.
  const temaName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of temas ?? []) m.set(t.id, t.name);
    return m;
  }, [temas]);

  const temaSelecionado = temaFilter ? (temaName.get(temaFilter) ?? null) : null;
  // Rótulo do contexto de origem (categoria do Kanban ou tema) para título/botão.
  const contextoLabel = catName ?? temaSelecionado ?? null;
  // Coerência (QA 2026-07-20): título/botão-voltar seguem o filtro EFETIVO de tema
  // (temaFilter), não mais o search param bruto — evita título e dropdown discordarem.
  const temContexto = !!cat || !!temaFilter;

  const rows: CaseRow[] = useMemo(() => (data ?? []) as CaseRow[], [data]);

  // Resolve o nome do tipo de caso: usa CASE_TYPE_LABELS para slugs legados,
  // e o nome do tema para cases criados via tema (cujo slug é ex.: "TEMA_1").
  const resolveTipo = (c: CaseRow): string => {
    const label = CASE_TYPE_LABELS[c.case_type as CaseType];
    if (label) return label;
    if (c.tema_id) return temaName.get(c.tema_id) ?? c.case_type;
    return c.case_type;
  };

  // Frentes ofertadas no filtro: as declaradas no tema (via useFrentes) ou, sem
  // tema, as presentes nos próprios casos.
  const frenteOptions = useMemo(() => {
    if (frentes && frentes.length > 0) {
      return frentes.map((f) => ({ slug: f.slug, label: f.label }));
    }
    const scope = cat ? rows.filter((r) => r.service_type_id === cat) : rows;
    const slugs = Array.from(
      new Set(scope.map((r) => r.frente_slug).filter((v): v is string => !!v)),
    ).sort();
    return slugs.map((s) => ({ slug: s, label: s }));
  }, [frentes, rows, cat]);

  // Pré-filtro: cat (categoria do Kanban) e tema (dropdown).
  const preFiltered = useMemo(() => {
    return rows.filter((c) => {
      if (cat && c.service_type_id !== cat) return false;
      if (temaFilter && c.tema_id !== temaFilter) return false;
      return true;
    });
  }, [rows, cat, temaFilter]);

  // Filtro combinado: painel de filtros dinâmicos + busca textual.
  const filtered = useMemo(() => {
    const afterPanel = applyCaseFilters(preFiltered, panelFilters);
    const q = search.trim().toLowerCase();
    if (!q) return afterPanel;
    return afterPanel.filter((c) => {
      const tipo = resolveTipo(c).toLowerCase();
      const op = (MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op).toLowerCase();
      const fin = (
        MACRO_FIN_LABELS[c.macrostatus_fin as MacroFin] ?? c.macrostatus_fin
      ).toLowerCase();
      const temaLabel = (c.tema_id ? (temaName.get(c.tema_id) ?? "") : "").toLowerCase();
      const canonText = c.canonical_fields
        ? JSON.stringify(c.canonical_fields).toLowerCase()
        : "";
      return (
        c.case_code.toLowerCase().includes(q) ||
        (c.client_name ?? "").toLowerCase().includes(q) ||
        tipo.includes(q) ||
        op.includes(q) ||
        fin.includes(q) ||
        temaLabel.includes(q) ||
        (c.frente_slug ?? "").toLowerCase().includes(q) ||
        (c.responsavel ?? "").toLowerCase().includes(q) ||
        (c.municipio ?? "").toLowerCase().includes(q) ||
        canonText.includes(q)
      );
    });
  }, [preFiltered, panelFilters, search, temaName]);

  // Ordenação sobre o filtrado COMPLETO (antes de paginar) — igual a busca atual.
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (c: CaseRow): string | number => {
      switch (sortKey) {
        case "case_code":
          return c.case_code.toLowerCase();
        case "client_name":
          return (c.client_name ?? "").toLowerCase();
        case "case_type":
          return resolveTipo(c).toLowerCase();
        case "tema":
          return (c.tema_id ? (temaName.get(c.tema_id) ?? "") : "").toLowerCase();
        case "frente_slug":
          return (c.frente_slug ?? "").toLowerCase();
        case "macrostatus_op":
          return (MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op).toLowerCase();
        case "macrostatus_fin":
          return (
            MACRO_FIN_LABELS[c.macrostatus_fin as MacroFin] ?? c.macrostatus_fin
          ).toLowerCase();
        case "responsavel":
          return (c.responsavel ?? "").toLowerCase();
        case "municipio":
          return (c.municipio ?? "").toLowerCase();
        case "valor_centavos":
          return c.valor_centavos ?? -1;
        case "created_at":
          return c.created_at ? new Date(c.created_at).getTime() : 0;
      }
    };
    // Cópia para não mutar o memo do filtro.
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir, temaName]);

  const sliced = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  // Cabeçalhos densos (Excel). `valor` só entra sob gate financeiro (AC-4).
  const columns: { key: SortKey; label: string }[] = [
    { key: "case_code", label: "Código" },
    { key: "client_name", label: "Cliente" },
    { key: "case_type", label: "Tipo de Caso" },
    { key: "tema", label: "Tema" },
    { key: "frente_slug", label: "Frente" },
    { key: "macrostatus_op", label: "Operacional" },
    { key: "macrostatus_fin", label: "Financeiro" },
    { key: "responsavel", label: "Responsáveis" },
    { key: "municipio", label: "Município" },
    ...(podeVerValor ? [{ key: "valor_centavos" as SortKey, label: "Valor" }] : []),
    { key: "created_at", label: "Criado em" },
  ];
  const colCount = columns.length;

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Operação", to: "/hoje" },
          { label: "Casos", to: "/casos" },
          { label: "Lista" },
        ]}
      />
      <PageHeader
        eyebrow="Operação"
        title={contextoLabel ? `Lista — ${contextoLabel}` : "Lista de casos"}
        subtitle={isLoading ? "Carregando…" : `${total} caso${total === 1 ? "" : "s"} no total.`}
        aside={
          <div className="flex items-center gap-2">
            {temContexto ? (
              // R2-08 — volta ao board do Kanban preservando a categoria/tema e a
              // frente ativa. `cat` é o service_type_id que o board consome.
              <Btn
                variant="outline"
                onClick={() =>
                  navigate({
                    to: "/pipeline",
                    search: {
                      ...(cat ? { cat, catName: catName ?? undefined } : {}),
                      ...(panelFilters.frente ? { frente: panelFilters.frente } : {}),
                    },
                  })
                }
              >
                <LayoutGrid size={14} />
                Kanban
              </Btn>
            ) : (
              <Link to="/casos">
                <Btn variant="outline">
                  <ArrowLeft size={14} />
                  Voltar ao Kanban
                </Btn>
              </Link>
            )}
          </div>
        }
      />

      {/* Barra de busca + seletor de tema */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[240px] max-w-lg">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por cliente, tipo, etapa, código, responsável, município, dados do caso…"
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        {(temas ?? []).length > 0 && (
          <select
            value={temaFilter}
            onChange={(e) => {
              setTemaFilter(e.target.value);
              setPanelFilters((f) => ({ ...f, frente: "" }));
              setPage(0);
            }}
            className="py-2.5 px-3 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          >
            <option value="">Todos os temas</option>
            {(temas ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Painel de filtros dinâmicos (fixos + campos do tema) */}
      <CaseFiltersPanel
        temaId={temaFilter || null}
        cases={preFiltered}
        filters={panelFilters}
        onChange={(f) => {
          setPanelFilters(f);
          setPage(0);
        }}
        frenteOptions={frenteOptions}
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar casos: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      <div className="card-editorial !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--gold-pale)]/40 border-b border-[var(--border)]">
                {columns.map((col) => {
                  const active = sortKey === col.key;
                  return (
                    <th key={col.key} className="text-left px-4 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-[var(--gold-700)] transition-colors"
                        title="Ordenar por esta coluna"
                      >
                        <Eyebrow>{col.label}</Eyebrow>
                        {active ? (
                          sortDir === "asc" ? (
                            <ChevronUp size={12} className="text-[var(--gold-700)]" />
                          ) : (
                            <ChevronDown size={12} className="text-[var(--gold-700)]" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-muted-foreground opacity-40" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[rgba(152,120,20,0.08)]">
                    <td colSpan={colCount} className="px-4 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              ) : sliced.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum caso encontrado.
                  </td>
                </tr>
              ) : (
                sliced.map((c) => (
                  // Ajuste A3 (2026-07-20) — a LINHA inteira é clicável (antes só o código).
                  <tr
                    key={c.id}
                    onClick={() => navigate({ to: "/casos/$id", params: { id: c.id } })}
                    className="border-b border-[rgba(152,120,20,0.08)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                      <Link
                        to="/casos/$id"
                        params={{ id: c.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-[var(--gold-700)]"
                      >
                        {c.case_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-[var(--navy)] shrink-0"
                          style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
                        >
                          {c.client_name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-[var(--navy)] font-medium">{c.client_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {resolveTipo(c)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {c.tema_id ? (temaName.get(c.tema_id) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {c.frente_slug ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap">
                      {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {MACRO_FIN_LABELS[c.macrostatus_fin as MacroFin] ?? c.macrostatus_fin}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {c.responsavel ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {c.municipio ?? "—"}
                    </td>
                    {podeVerValor && (
                      <td className="px-4 py-3 font-mono text-[var(--navy)] whitespace-nowrap">
                        {fmtBRL(c.valor_centavos)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {fmtDate(c.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            Página {page + 1} de {totalPages} · {total} casos
          </span>
          <div className="flex gap-2">
            <Btn
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Próximo
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
