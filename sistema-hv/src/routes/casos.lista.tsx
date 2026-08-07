import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Columns3,
  LayoutGrid,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import {
  CaseFiltersPanel,
  applyCaseFilters,
  type CaseFilterValues,
} from "@/components/cases/CaseFiltersPanel";
import { InlineCanonicalCell } from "@/components/cases/InlineCanonicalCell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { useBoards, useCaseIdsByBoard, useExclusiveCaseIds } from "@/hooks/useBoards";
import { useMyModulePerms, useMyModuleValues } from "@/hooks/usePermissions";
import { readFieldValue } from "@/lib/cases/tema-field-value";
import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";
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
  // TAREFA B (2026-08-04) — kanban escolhido (board.id). Ausente = "Todos os
  // kanbans" (default: junta todos). Semeado ao vir do Kanban custom via "Ver em lista".
  board: z.string().uuid().optional().catch(undefined),
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
  caso_pasta_nome: string | null;
  macrostatus_op: string;
  macrostatus_fin: string;
  municipio: string | null;
  valor_centavos: number | null;
  responsavel: string | null;
  created_at: string | null;
  canonical_fields: Record<string, unknown> | null;
  // #3 — custom_fields do cliente (anexado por listCases via mutação, então
  // opcional no tipo) p/ campos de tema com scope='cliente'.
  client_custom_fields?: Record<string, unknown> | null;
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
  const { cat, catName, tema, frente, board } = Route.useSearch();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  // Tema selecionado (seed do search param ou dropdown).
  const [temaFilter, setTemaFilter] = useState<string>(tema ?? "");
  // TAREFA B — kanban escolhido (board.id). "" = "Todos os kanbans" (default:
  // junta todos os kanbans do tema, sem excluir os movidos p/ custom).
  const [boardFilter, setBoardFilter] = useState<string>(board ?? "");
  // Painel de filtros dinâmicos (fixos + canonical do tema).
  const [panelFilters, setPanelFilters] = useState<CaseFilterValues>({
    etapaOp: "",
    etapaFin: "",
    responsavel: "",
    municipio: "",
    frente: frente ?? "",
    caso: "",
    canonical: {},
  });
  // Ordenação por coluna (default: mais recentes primeiro, como o servidor já
  // devolve por created_at desc).
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // E1 (2026-08-05) — menu "Colunas": colunas fixas ocultadas manualmente pelo
  // usuário (por SortKey). Independente do auto-ocultar da coluna Tema. O usuário
  // também pode recolher o painel de filtros por aqui (menos ruído na Lista).
  const [hiddenCols, setHiddenCols] = useState<Set<SortKey>>(() => new Set());
  const [filtersVisible, setFiltersVisible] = useState(true);

  const { data, isLoading, isError, error } = useCasesList();
  const { data: temas } = useTemas();
  const { data: frentes } = useFrentes(temaFilter || null);
  // R2-09 — tema EFETIVO: o escolhido no dropdown OU, quando a Lista foi aberta a
  // partir do Kanban (search param `cat` = service_type_id), o tema dono desse
  // service_type. Assim o botão "Editar filtros", as colunas e o matching por
  // tipo funcionam na Lista mesmo sem escolher o tema no dropdown.
  const effectiveTemaId = useMemo(() => {
    if (temaFilter) return temaFilter;
    if (cat) {
      const t = (temas ?? []).find(
        (x) => (x as { service_type_id?: string | null }).service_type_id === cat,
      );
      return t?.id ?? "";
    }
    return "";
  }, [temaFilter, cat, temas]);
  // TAREFA B — service_type_id do tema efetivo (os boards são por service_type).
  const effectiveServiceTypeId = useMemo(() => {
    if (!effectiveTemaId) return "";
    const t = (temas ?? []).find((x) => x.id === effectiveTemaId);
    return (t as { service_type_id?: string | null } | undefined)?.service_type_id ?? "";
  }, [effectiveTemaId, temas]);
  // TAREFA B — kanbans do tema (principal + custom). Só habilita o seletor quando
  // há um tema efetivo. Enquanto não houver tema, "Escolher kanban" fica oculto.
  const { data: boards } = useBoards(effectiveServiceTypeId);
  const boardList = (boards ?? []) as {
    id: string;
    label: string;
    is_principal: boolean;
    ordem: number;
  }[];
  const selectedBoard = boardFilter ? boardList.find((b) => b.id === boardFilter) : undefined;
  const filterByPrincipal = !!selectedBoard?.is_principal;
  const filterByCustomBoardId =
    selectedBoard && !selectedBoard.is_principal ? selectedBoard.id : null;
  // Conjuntos de ids p/ o filtro por kanban:
  //   • principal → exclui os casos MOVIDOS exclusivamente p/ custom.
  //   • custom    → mantém só os casos posicionados naquele board.
  const { data: customBoardCaseIds } = useCaseIdsByBoard(filterByCustomBoardId);
  const { data: exclusiveIds } = useExclusiveCaseIds(filterByPrincipal);

  // R2-09 — filtros/campos customizados do tema efetivo (nível do tema). Viram
  // COLUNAS editáveis inline e alimentam o matching por tipo dos filtros.
  const { data: temaDefsData } = useTemaFieldDefs(effectiveTemaId || null);
  const temaDefs = useMemo(() => (temaDefsData ?? []) as TemaFieldDef[], [temaDefsData]);
  // Colunas dinâmicas só quando há um tema efetivo (defs de vários temas
  // misturados não fariam sentido na mesma tabela). #5 — campos marcados
  // "ocultar na lista" (hidden_in_list) saem da COLUNA (seguem no filtro/ficha).
  const dynamicDefs = effectiveTemaId ? temaDefs.filter((d) => !d.hidden_in_list) : [];

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
  // Rótulo do contexto para título/botão. Se o usuário escolheu um TEMA no
  // dropdown, o título segue o tema (não o `cat` de origem) — senão o título diria
  // "1% fies" mostrando casos de outro tema.
  const contextoLabel = temaSelecionado ?? catName ?? null;
  // Coerência (QA 2026-07-20): título/botão-voltar seguem o filtro EFETIVO de tema
  // (temaFilter), não mais o search param bruto — evita título e dropdown discordarem.
  const temContexto = !!cat || !!temaFilter;

  const rows: CaseRow[] = useMemo(() => (data ?? []) as CaseRow[], [data]);

  // Resolve o nome do tipo de caso: prioriza caso_pasta_nome (pasta de caso
  // escolhida na criação), depois CASE_TYPE_LABELS para slugs legados, e por
  // último o nome do tema.
  const resolveTipo = (c: CaseRow): string => {
    if (c.caso_pasta_nome) return c.caso_pasta_nome;
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

  // Pré-filtro: cat (categoria do Kanban de origem), tema (dropdown) e kanban
  // (TAREFA B). Conjuntos de ids p/ o filtro por kanban (memoizados).
  const customIdSet = useMemo(
    () => (filterByCustomBoardId ? new Set(customBoardCaseIds ?? []) : null),
    [filterByCustomBoardId, customBoardCaseIds],
  );
  const exclusiveIdSet = useMemo(
    () => (filterByPrincipal ? new Set(exclusiveIds ?? []) : null),
    [filterByPrincipal, exclusiveIds],
  );
  const preFiltered = useMemo(() => {
    return rows.filter((c) => {
      // Se o usuário escolheu um TEMA no dropdown, o tema MANDA e ignora o `cat`
      // (service_type de origem, quando a Lista veio de um Kanban). Sem isso,
      // trocar o tema intersectava com o service_type antigo → 0 casos para
      // qualquer tema diferente do de origem. Vale p/ todos os temas.
      if (temaFilter) {
        if (c.tema_id !== temaFilter) return false;
      } else if (cat && c.service_type_id !== cat) {
        return false;
      }
      // TAREFA B — filtro por kanban específico (só quando um kanban foi escolhido):
      //   • custom    → mantém só os casos posicionados naquele board.
      //   • principal → exclui os casos movidos exclusivamente p/ custom.
      // Default ("Todos os kanbans") não filtra nada aqui (vê tudo do tema).
      if (customIdSet) return customIdSet.has(c.id);
      if (exclusiveIdSet) return !exclusiveIdSet.has(c.id);
      return true;
    });
  }, [rows, cat, temaFilter, customIdSet, exclusiveIdSet]);

  // Filtro combinado: painel de filtros dinâmicos + busca textual.
  const filtered = useMemo(() => {
    const afterPanel = applyCaseFilters(
      preFiltered,
      panelFilters,
      temaDefs.map((d) => ({ key: d.key, type: d.type, scope: d.scope })),
    );
    const q = search.trim().toLowerCase();
    if (!q) return afterPanel;
    return afterPanel.filter((c) => {
      const tipo = resolveTipo(c).toLowerCase();
      const op = (MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op).toLowerCase();
      const fin = (
        MACRO_FIN_LABELS[c.macrostatus_fin as MacroFin] ?? c.macrostatus_fin
      ).toLowerCase();
      const temaLabel = (c.tema_id ? (temaName.get(c.tema_id) ?? "") : "").toLowerCase();
      const canonText = c.canonical_fields ? JSON.stringify(c.canonical_fields).toLowerCase() : "";
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
  }, [preFiltered, panelFilters, search, temaName, temaDefs]);

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

  // E1/E2 (2026-08-05) — quando a Lista está restrita a UM único tema
  // (effectiveTemaId), a coluna "Tema" é redundante com "Tipo de Caso" (repete o
  // mesmo rótulo em toda linha). Auto-oculta nesse caso; em "Todos os temas" ela
  // volta. O usuário ainda pode ocultar/mostrar colunas fixas pelo menu "Colunas".
  const temaColRedundant = !!effectiveTemaId;

  // Cabeçalhos densos (Excel). `valor` só entra sob gate financeiro (AC-4).
  // Ordem E2: Tema ANTES de Tipo de Caso (mais legível na visão "Todos os temas").
  const allColumns: { key: SortKey; label: string }[] = [
    { key: "case_code", label: "Código" },
    { key: "client_name", label: "Cliente" },
    { key: "tema", label: "Tema" },
    { key: "case_type", label: "Tipo de Caso" },
    { key: "frente_slug", label: "Frente" },
    { key: "macrostatus_op", label: "Operacional" },
    { key: "macrostatus_fin", label: "Financeiro" },
    { key: "responsavel", label: "Responsáveis" },
    { key: "municipio", label: "Município" },
    ...(podeVerValor ? [{ key: "valor_centavos" as SortKey, label: "Valor" }] : []),
    { key: "created_at", label: "Criado em" },
  ];
  // E1 — colunas EFETIVAS: tira a Tema redundante e as ocultadas no menu.
  const isColHidden = (key: SortKey) => (key === "tema" && temaColRedundant) || hiddenCols.has(key);
  const columns = allColumns.filter((col) => !isColHidden(col.key));
  const colCount = columns.length + dynamicDefs.length;

  // E1 — colunas que o usuário PODE ligar/desligar no menu (todas menos a Tema
  // quando ela já é auto-ocultada por redundância, para não dar a impressão de
  // que dá pra trazê-la de volta enquanto está num único tema).
  const toggleableColumns = allColumns.filter((col) => !(col.key === "tema" && temaColRedundant));

  // E1 — renderiza a célula do corpo de uma coluna fixa. Fica como closure (usa
  // resolveTipo/temaName/fmt*) para que o corpo itere por `columns` respeitando a
  // ordem (Tema→Tipo) e a visibilidade sem duplicar a árvore de <td>.
  function CaseCell({ col, row: c }: { col: SortKey; row: CaseRow }) {
    switch (col) {
      case "case_code":
        return (
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
        );
      case "client_name":
        return (
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
        );
      case "tema":
        return (
          <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
            {c.tema_id ? (temaName.get(c.tema_id) ?? "—") : "—"}
          </td>
        );
      case "case_type":
        return (
          <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
            {resolveTipo(c)}
          </td>
        );
      case "frente_slug":
        return (
          <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
            {c.frente_slug ?? "—"}
          </td>
        );
      case "macrostatus_op":
        return (
          <td className="px-4 py-3 text-[12px] whitespace-nowrap">
            {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
          </td>
        );
      case "macrostatus_fin":
        return (
          <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
            {MACRO_FIN_LABELS[c.macrostatus_fin as MacroFin] ?? c.macrostatus_fin}
          </td>
        );
      case "responsavel":
        return (
          <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
            {c.responsavel ?? "—"}
          </td>
        );
      case "municipio":
        return (
          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
            {c.municipio ?? "—"}
          </td>
        );
      case "valor_centavos":
        return (
          <td className="px-4 py-3 font-mono text-[var(--navy)] whitespace-nowrap">
            {fmtBRL(c.valor_centavos)}
          </td>
        );
      case "created_at":
        return (
          <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
            {fmtDate(c.created_at)}
          </td>
        );
    }
  }

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
              // TAREFA B — trocar de tema reseta o kanban p/ "Todos os kanbans".
              setBoardFilter("");
              navigate({
                to: "/casos/lista",
                search: (prev) => ({ ...prev, board: undefined }),
                replace: true,
              });
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
        {/* TAREFA B — "Escolher kanban": só quando há um tema efetivo. Default =
            "Todos os kanbans" (junta todos, inclusive os movidos p/ custom).
            Filtrar por um kanban específico reduz a lista àquele kanban. */}
        {effectiveTemaId && boardList.length > 0 && (
          <select
            value={boardFilter}
            onChange={(e) => {
              const v = e.target.value;
              setBoardFilter(v);
              navigate({
                to: "/casos/lista",
                search: (prev) => ({ ...prev, board: v || undefined }),
                replace: true,
              });
              setPage(0);
            }}
            className="py-2.5 px-3 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
            title="Escolher kanban"
          >
            <option value="">Todos os kanbans</option>
            {boardList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.is_principal ? `${b.label} (principal)` : b.label}
              </option>
            ))}
          </select>
        )}

        {/* E1 (2026-08-05) — menu "Colunas": ocultar/mostrar colunas fixas e
            recolher o painel de filtros. Reusa Popover + Checkbox (padrão do
            filtro multi-valor). As colunas dinâmicas do tema seguem sendo
            geridas em "Editar campos" (hidden_in_list). */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Ocultar colunas e filtros"
              className="flex items-center gap-1.5 py-2.5 px-3 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] text-muted-foreground hover:text-[var(--navy)] hover:border-[var(--gold)] transition-colors outline-none"
            >
              <Columns3 size={14} />
              Colunas
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <div className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Colunas visíveis
            </div>
            <div className="max-h-64 space-y-0.5 overflow-auto">
              {toggleableColumns.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--muted)]"
                >
                  <Checkbox
                    checked={!hiddenCols.has(col.key)}
                    onCheckedChange={(checked) => {
                      setHiddenCols((prev) => {
                        const next = new Set(prev);
                        if (checked === true) next.delete(col.key);
                        else next.add(col.key);
                        return next;
                      });
                    }}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-1.5 border-t border-[rgba(120,96,30,0.1)] pt-1.5">
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--muted)]">
                <Checkbox
                  checked={filtersVisible}
                  onCheckedChange={(checked) => setFiltersVisible(checked === true)}
                />
                <span>Mostrar filtros</span>
              </label>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Painel de filtros dinâmicos (fixos + campos do tema). E1 — pode ser
          recolhido pelo menu "Colunas" (filtersVisible). */}
      {filtersVisible && (
        <CaseFiltersPanel
          temaId={effectiveTemaId || null}
          cases={preFiltered}
          filters={panelFilters}
          onChange={(f) => {
            setPanelFilters(f);
            setPage(0);
          }}
          frenteOptions={frenteOptions}
        />
      )}

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
                {/* R2-09 — colunas dos filtros/campos do tema (editáveis inline).
                    Não ordenáveis (valor livre). */}
                {dynamicDefs.map((def) => (
                  <th key={def.id} className="text-left px-4 py-3.5 whitespace-nowrap">
                    <Eyebrow>{def.label}</Eyebrow>
                  </th>
                ))}
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
                    {/* E1 (2026-08-05) — células seguem a ORDEM e a VISIBILIDADE de
                        `columns` (Tema antes de Tipo; auto-oculta Tema num único
                        tema; menu "Colunas" liga/desliga fixas). */}
                    {columns.map((col) => (
                      <CaseCell key={col.key} col={col.key} row={c} />
                    ))}
                    {/* 2026-07-29 #4 — células dos campos do tema em SÓ LEITURA:
                        refletem a ficha; a edição é só na ficha do caso. #3: o
                        valor vem da fonte certa (caso × cliente). */}
                    {dynamicDefs.map((def) => (
                      <td
                        key={def.id}
                        className="px-3 py-2 text-[12px] text-muted-foreground whitespace-nowrap"
                      >
                        <InlineCanonicalCell
                          caseId={c.id}
                          def={def}
                          value={readFieldValue(def, {
                            canonical_fields: c.canonical_fields,
                            client_custom_fields: c.client_custom_fields,
                          })}
                          canEdit={false}
                        />
                      </td>
                    ))}
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
