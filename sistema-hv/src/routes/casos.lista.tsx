import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpDown, ChevronDown, ChevronUp, LayoutGrid, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { useMyModulePerms } from "@/hooks/usePermissions";
import { useFrentes, useTemas } from "@/hooks/useTemas";
import { useAuth } from "@/lib/auth";
import { permissaoEfetiva } from "@/lib/rbac";
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
  // R2-08 — filtro de frente na Lista (chips). Semeado pelo search param.
  const [frenteFilter, setFrenteFilter] = useState<string>(frente ?? "");
  // Ordenação por coluna (default: mais recentes primeiro, como o servidor já
  // devolve por created_at desc).
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, isError, error } = useCasesList();
  const { data: temas } = useTemas();
  const { data: frentes } = useFrentes(tema ?? null);

  // R4-01 / R2-08 (AC-4) — a coluna "valor" só aparece sob gate financeiro.
  // Único booleano trocável; overrides por usuário via permissaoEfetiva. Com a
  // tabela de overrides vazia é IDÊNTICO ao papel (regressão zero).
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  const podeVerValor = permissaoEfetiva(role, perms ?? {}, "financeiro", "view");

  // Mapa id→nome de tema para exibir a coluna Tema e ordenar por rótulo.
  const temaName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of temas ?? []) m.set(t.id, t.name);
    return m;
  }, [temas]);

  const temaSelecionado = tema ? (temaName.get(tema) ?? null) : null;
  // Rótulo do contexto de origem (categoria do Kanban ou tema) para título/botão.
  const contextoLabel = catName ?? temaSelecionado ?? null;
  const temContexto = !!cat || !!tema;

  const rows: CaseRow[] = useMemo(() => (data ?? []) as CaseRow[], [data]);

  // Frentes ofertadas no filtro: as declaradas no tema (via useFrentes) ou, sem
  // tema, as presentes nos próprios casos.
  const frenteOptions = useMemo(() => {
    if (frentes && frentes.length > 0) {
      return frentes.map((f) => ({ slug: f.slug, label: f.label }));
    }
    // Sem tema (ex.: veio da categoria do Kanban): as frentes presentes nos casos
    // do contexto (respeita o filtro de categoria para não ofertar frentes de fora).
    const scope = cat ? rows.filter((r) => r.service_type_id === cat) : rows;
    const slugs = Array.from(
      new Set(scope.map((r) => r.frente_slug).filter((v): v is string => !!v)),
    ).sort();
    return slugs.map((s) => ({ slug: s, label: s }));
  }, [frentes, rows, cat]);

  // Filtro combinado: search param `tema` + chip de frente + busca client-side.
  // Aplicado sobre o CONJUNTO COMPLETO antes de ordenar/paginar (AC-3/AC-6).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      // `cat` (categoria do Kanban) filtra pelo MESMO eixo do board: service_type_id.
      if (cat && c.service_type_id !== cat) return false;
      if (tema && c.tema_id !== tema) return false;
      if (frenteFilter && (c.frente_slug ?? "") !== frenteFilter) return false;
      if (!q) return true;
      const tipo = (CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type).toLowerCase();
      const op = (MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op).toLowerCase();
      const fin = (
        MACRO_FIN_LABELS[c.macrostatus_fin as MacroFin] ?? c.macrostatus_fin
      ).toLowerCase();
      const temaLabel = (c.tema_id ? (temaName.get(c.tema_id) ?? "") : "").toLowerCase();
      return (
        c.case_code.toLowerCase().includes(q) ||
        (c.client_name ?? "").toLowerCase().includes(q) ||
        tipo.includes(q) ||
        op.includes(q) ||
        fin.includes(q) ||
        temaLabel.includes(q) ||
        (c.frente_slug ?? "").toLowerCase().includes(q) ||
        (c.responsavel ?? "").toLowerCase().includes(q) ||
        (c.municipio ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, cat, tema, frenteFilter, temaName]);

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
          return (CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type).toLowerCase();
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
    { key: "case_type", label: "Tipo" },
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
                      ...(frenteFilter ? { frente: frenteFilter } : {}),
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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
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
            placeholder="Buscar por cliente, categoria, etapa, tema, frente, código…"
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>

        {/* R2-08 — filtro de frente (chips), disponível quando há frentes. */}
        {frenteOptions.length > 0 && (
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
            <button
              type="button"
              onClick={() => {
                setFrenteFilter("");
                setPage(0);
              }}
              className={
                frenteFilter === ""
                  ? "px-3 py-1.5 bg-[var(--gold)] text-white"
                  : "px-3 py-1.5 text-muted-foreground hover:bg-[var(--muted)]"
              }
            >
              Todas as frentes
            </button>
            {frenteOptions.map((fr) => (
              <button
                key={fr.slug}
                type="button"
                onClick={() => {
                  setFrenteFilter(fr.slug);
                  setPage(0);
                }}
                className={
                  frenteFilter === fr.slug
                    ? "px-3 py-1.5 bg-[var(--gold)] text-white"
                    : "px-3 py-1.5 text-muted-foreground hover:bg-[var(--muted)] border-l border-[var(--border)]"
                }
              >
                {fr.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
                  <tr
                    key={c.id}
                    className="border-b border-[rgba(152,120,20,0.08)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                      <Link
                        to="/casos/$id"
                        params={{ id: c.id }}
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
                      {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
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
