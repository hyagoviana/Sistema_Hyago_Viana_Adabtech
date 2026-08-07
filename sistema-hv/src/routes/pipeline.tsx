import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FolderKanban,
  Layers,
  List,
  Pencil,
  Plus,
  Search,
  Settings2,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { CaseCardReal } from "@/components/cases/CaseCardReal";
import {
  CaseFiltersPanel,
  applyCaseFilters,
  type CaseFilterValues,
} from "@/components/cases/CaseFiltersPanel";
import { TemasManagerDialog } from "@/components/pipeline/TemasManagerDialog";
import { KanbanBoard, type KanbanColumn } from "@/components/cases/KanbanBoard";
import { StageEditor } from "@/components/cases/StageEditor";
import { Breadcrumb, Btn, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useCasesByServiceType,
  useMoveCaseStageFin,
  useMoveCaseStageOp,
  useStages,
} from "@/hooks/usePipeline";
import { useBoards, useBoardStages, useCasesByBoard, useMoveCaseInBoard } from "@/hooks/useBoards";
import { BoardsManagerDialog } from "@/components/pipeline/BoardsManagerDialog";
import { KanbanPickerPage } from "@/components/pipeline/KanbanPickerPage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePodeEditar } from "@/hooks/usePermissions";
import { useTemaFieldDefs } from "@/hooks/useTemaFieldDefs";
import { useTemas } from "@/hooks/useTemas";

// (item 2, 2026-07-09) — a categoria selecionada vive na URL (search param `cat`).
// Assim, clicar em "Pipeline Operacional" no menu (Link sem search) VOLTA ao
// seletor de categorias — mesmo padrão do financeiro.
const searchSchema = z.object({
  cat: z.string().uuid().optional().catch(undefined),
  catName: z.string().optional().catch(undefined),
  // R2-08 — frente ativa (semeada ao voltar da Lista via toggle "Kanban").
  frente: z.string().optional().catch(undefined),
  // A3 — board/lista selecionado (undefined = board principal / operacional).
  board: z.string().uuid().optional().catch(undefined),
  // C4/C5 (correção 2026-08-07) — tela intermediária de escolha de kanban + notas do
  // tema. `picker=true` renderiza a página de escolha; `temaId` alimenta o bloco de notas.
  picker: z.boolean().optional().catch(undefined),
  temaId: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/pipeline")({
  component: PipelinePage,
  validateSearch: (search) => searchSchema.parse(search),
});

function roleColor(role: string): string {
  switch (role) {
    case "won":
      return "var(--success)";
    case "lost":
      return "var(--danger)";
    case "closed":
      return "var(--muted-foreground)";
    default:
      return "var(--navy)";
  }
}

function PipelinePage() {
  const { cat, catName, frente, board, picker, temaId } = Route.useSearch();
  const navigate = useNavigate();

  const onBack = () => navigate({ to: "/pipeline", search: {} });

  // C4/C5 — tela intermediária: escolher o kanban + ver/editar as notas do tema.
  // Aparece SEMPRE que se clica num tema (mesmo com 1 kanban), antes da esteira.
  if (cat && picker) {
    return (
      <KanbanPickerPage
        serviceTypeId={cat}
        name={catName ?? "·"}
        temaId={temaId ?? null}
        onBack={onBack}
        onPick={(boardId) =>
          navigate({
            to: "/pipeline",
            search: {
              cat,
              ...(catName ? { catName } : {}),
              ...(boardId ? { board: boardId } : {}),
            },
          })
        }
      />
    );
  }

  if (cat) {
    return (
      <DynamicKanban
        serviceType={{ id: cat, name: catName ?? "·" }}
        initialFrente={frente ?? ""}
        boardId={board ?? null}
        onBack={onBack}
      />
    );
  }
  return <ServiceTypeSelection />;
}

function ServiceTypeSelection() {
  // T1 (2026-07-19) — o seletor do Pipeline mostra SÓ os TEMAS (o dono não quer os
  // tipos legados aqui). Cada tema abre a esteira do seu service_type interno
  // (motor). Casos de tipos antigos ainda não vinculados a um tema seguem
  // acessíveis na Lista de casos até serem vinculados pela ficha.
  const { data: temas, isLoading } = useTemas();
  const { role } = useAuth();
  const canManage = can(role, "config.manage");
  const navigate = useNavigate();
  // R2-06 — gestão de TEMAS/FRENTES (admin-only). `editTemaId` abre o editor direto
  // no tema clicado (lápis no card); null = abre no modo criar ("Novo tema").
  const [temasOpen, setTemasOpen] = useState(false);
  const [editTemaId, setEditTemaId] = useState<string | null>(null);

  function openTemas(temaId: string | null) {
    setEditTemaId(temaId);
    setTemasOpen(true);
  }

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Pipeline Operacional" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Operacional"
        subtitle="Escolha o tema para abrir a esteira."
        aside={
          <div className="flex items-center gap-2">
            {canManage && (
              <Btn variant="gold" onClick={() => openTemas(null)}>
                <Plus size={14} />
                Novo tema
              </Btn>
            )}
            {canManage && (
              <Btn
                variant="ghost"
                onClick={() => navigate({ to: "/configuracoes/campos-personalizados" })}
              >
                <Settings2 size={14} />
                Campos personalizados
              </Btn>
            )}
            <Btn variant="ghost" onClick={() => navigate({ to: "/casos/lista", search: {} })}>
              <List size={14} />
              Ver todos em lista
            </Btn>
            {canManage && (
              <Btn variant="ghost" onClick={() => openTemas(null)}>
                <Tag size={14} />
                Temas
              </Btn>
            )}
          </div>
        }
      />

      {/* R2-06 — gestão de temas/frentes (admin-only, gate acima). `openTemaId`
          abre direto no editor do tema (lápis no card). */}
      {canManage && (
        <TemasManagerDialog
          open={temasOpen}
          onOpenChange={(o) => {
            setTemasOpen(o);
            if (!o) setEditTemaId(null);
          }}
          openTemaId={editTemaId}
        />
      )}

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando temas…</div>
      ) : (temas ?? []).length === 0 ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Layers size={15} /> Nenhum tema cadastrado ainda.{" "}
            {canManage ? 'Crie o primeiro em "Temas".' : "Peça a um administrador para criar."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(temas ?? []).map((t) => {
            const stId = (t as { service_type_id?: string | null }).service_type_id ?? null;
            return (
              <div
                key={t.id}
                className="card-hero relative p-6 hover:border-[var(--gold)] transition-colors group"
              >
                <button
                  type="button"
                  disabled={!stId}
                  onClick={() =>
                    stId &&
                    navigate({
                      to: "/pipeline",
                      search: { cat: stId, catName: t.name, temaId: t.id, picker: true },
                    })
                  }
                  className="flex items-center gap-3 text-left w-full disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}
                  >
                    <FolderKanban size={20} />
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--navy)]">{t.name}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {stId ? "Abrir esteira →" : "Sem pipeline (recadastre o tema)"}
                    </div>
                  </div>
                </button>
                {canManage && (
                  <button
                    type="button"
                    title="Editar tema (nome, frentes, pastas)"
                    onClick={() => openTemas(t.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-[var(--muted)] hover:text-[var(--navy)] transition-opacity"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] text-muted-foreground mt-6 max-w-2xl">
        Só os temas aparecem aqui. Casos de tipos antigos, ainda não vinculados a um tema, continuam
        acessíveis pela Lista de casos · vincule-os a um tema pela ficha do caso.
      </p>
    </div>
  );
}

// A3 — wrapper: resolve o board selecionado (search param) e delega ao Kanban
// PRINCIPAL (operacional) ou ao Kanban de um board CUSTOM. As sub-telas mantêm
// cada uma seus próprios hooks (rules-of-hooks OK — nenhum hook antes deste ponto).
function DynamicKanban({
  serviceType,
  initialFrente = "",
  boardId = null,
  onBack,
}: {
  serviceType: { id: string; name: string };
  initialFrente?: string;
  boardId?: string | null;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { data: boards } = useBoards(serviceType.id);
  // Fix — a troca de kanban usa ESTADO LOCAL: clicar num pill reflete NA HORA, sem
  // depender da reatividade do search-param da URL (que estava não trocando a
  // visão). A URL é mantida em sincronia só para deep-link / voltar do navegador.
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(boardId ?? null);
  useEffect(() => {
    setSelectedBoardId(boardId ?? null);
  }, [boardId]);
  const activeBoard = selectedBoardId
    ? ((boards ?? []).find((b) => b.id === selectedBoardId) ?? null)
    : null;
  const selectBoard = (id: string | null) => {
    setSelectedBoardId(id);
    navigate({
      to: "/pipeline",
      search: {
        cat: serviceType.id,
        catName: serviceType.name,
        ...(id ? { board: id } : {}),
      },
    });
  };

  if (activeBoard && !activeBoard.is_principal) {
    return (
      <CustomBoardKanban
        serviceType={serviceType}
        board={activeBoard}
        boards={boards ?? []}
        onSelectBoard={selectBoard}
        onBack={onBack}
      />
    );
  }
  return (
    <PrincipalKanban
      serviceType={serviceType}
      initialFrente={initialFrente}
      boards={boards ?? []}
      onSelectBoard={selectBoard}
      onBack={onBack}
    />
  );
}

function PrincipalKanban({
  serviceType,
  initialFrente = "",
  boards,
  onSelectBoard,
  onBack,
}: {
  serviceType: { id: string; name: string };
  initialFrente?: string;
  boards: BoardRow[];
  onSelectBoard: (id: string | null) => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const principalBoard = boards.find((b) => b.is_principal) ?? null;
  const [boardsManagerOpen, setBoardsManagerOpen] = useState(false);
  // A5 — `kind` fica fixo em "op" (o toggle foi removido); mantido como união de
  // tipos para preservar o narrowing das checagens `kind === "fin"` existentes.
  const [kind] = useState<"op" | "fin">("op");
  // Ajuste A4 (2026-07-20, Adavio) — busca rápida no Kanban (cliente/código).
  const [search, setSearch] = useState("");
  // Painel de filtros dinâmicos (fixos + campos canônicos do tema).
  const [panelFilters, setPanelFilters] = useState<CaseFilterValues>({
    etapaOp: "",
    etapaFin: "",
    responsavel: "",
    municipio: "",
    frente: initialFrente,
    caso: "",
    canonical: {},
  });
  // Resolve o tema_id a partir do service_type_id (lookup reverso nos temas).
  const { data: temas } = useTemas();
  const temaId = useMemo(() => {
    for (const t of temas ?? []) {
      if ((t as { service_type_id?: string | null }).service_type_id === serviceType.id)
        return t.id;
    }
    return null;
  }, [temas, serviceType.id]);
  // R2-09 — defs de filtros do tema, para o matching correto por tipo (dropdown
  // = igualdade, texto = contém) no applyCaseFilters.
  const { data: temaDefsData } = useTemaFieldDefs(temaId);
  const temaFilterDefs = useMemo(
    () =>
      ((temaDefsData ?? []) as { key: string; type: string; scope?: string }[]).map((d) => ({
        key: d.key,
        type: d.type,
        scope: d.scope,
      })),
    [temaDefsData],
  );
  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, kind);
  const { data: allCases, isLoading, isError, error } = useCasesByServiceType(serviceType.id);
  const moveOp = useMoveCaseStageOp(serviceType.id);
  const moveFin = useMoveCaseStageFin(serviceType.id);
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");
  const podeEditar = usePodeEditar("operacional");
  const [editorOpen, setEditorOpen] = useState(false);

  // Financeiro mostra só casos bifurcados (com etapa financeira ativa).
  // Operacional esconde os casos "somente financeiro" (S19 / ADR-016) — filtro SÓ aqui,
  // nunca na fonte/view, senão o caso sumiria das duas pipelines.
  const baseCases =
    kind === "fin"
      ? (allCases ?? []).filter((c) => c.macrostatus_fin && c.macrostatus_fin !== "NAO_APLICAVEL")
      : (allCases ?? []).filter((c) => {
          const cc = c as {
            removido_do_operacional_at?: string | null;
            lifecycle?: string | null;
            aguardando_assinatura_at?: string | null;
            procuracao_assinada_at?: string | null;
          };
          // Fora os removidos do operacional (viraram financeiro-only).
          if (cc.removido_do_operacional_at) return false;
          // R2-11 — leads em fase COMERCIAL (procuração pendente OU assinada, mas
          // ainda LEAD = não promovidos ao operacional) NÃO aparecem no Kanban do
          // tema. Entram só quando "Vincular a um tema" os promove a CLIENTE. Casos
          // criados direto (LEAD sem procuração/aguardando) e clientes aparecem.
          if (cc.lifecycle === "LEAD" && (cc.aguardando_assinatura_at || cc.procuracao_assinada_at))
            return false;
          return true;
        });

  const caseFrente = (c: unknown) => (c as { frente_slug?: string | null }).frente_slug ?? null;

  // R2-05 — lista de frentes disponíveis para o filtro: as frentes presentes nos
  // casos do board + as frentes declaradas nas etapas (system_pipeline_stages.frente_slug).
  const frenteOptions = Array.from(
    new Set(
      [
        ...baseCases.map((c) => caseFrente(c)),
        ...(stages ?? []).map((s) => (s as { frente_slug?: string | null }).frente_slug ?? null),
      ].filter((v): v is string => !!v),
    ),
  ).sort();

  // Aplica filtros do painel (frente, etapas, responsável, município, canonical).
  const frenteFilter = panelFilters.frente;
  const applyFrente = kind === "op" && frenteFilter !== "";
  const afterPanel = applyCaseFilters(
    baseCases as ((typeof baseCases)[number] & {
      canonical_fields?: Record<string, unknown> | null;
    })[],
    panelFilters,
    temaFilterDefs,
  );
  // Ajuste A4 — busca rápida por nome do cliente ou código do caso.
  const q = search.trim().toLowerCase();
  const cases = q
    ? afterPanel.filter((c) => {
        const nome = (c as { client_name?: string | null }).client_name ?? "";
        const code = (c as { case_code?: string | null }).case_code ?? "";
        const mun = (c as { municipio?: string | null }).municipio ?? "";
        const resp = (c as { responsavel?: string | null }).responsavel ?? "";
        const canon = (c as { canonical_fields?: Record<string, unknown> | null }).canonical_fields;
        const canonText = canon ? JSON.stringify(canon).toLowerCase() : "";
        return (
          nome.toLowerCase().includes(q) ||
          code.toLowerCase().includes(q) ||
          mun.toLowerCase().includes(q) ||
          resp.toLowerCase().includes(q) ||
          canonText.includes(q)
        );
      })
    : afterPanel;

  // R2-05 — colunas: oculta etapas CONDICIONAIS vazias de outra frente. Regra:
  // uma etapa com `frente_slug` (condicional) só aparece se (a) pertence à frente
  // filtrada OU (b) há algum caso do board nela. Etapas comuns (frente_slug NULL)
  // sempre aparecem. Sem filtro de frente, oculta condicionais de OUTRA frente
  // apenas quando estão vazias (mantém progresso visível).
  const casesInSlug = (slug: string) => cases.some((c) => c.macrostatus_op === slug);
  const columns: KanbanColumn<string>[] = (stages ?? [])
    .filter((s) => !(kind === "fin" && s.slug === "NAO_APLICAVEL"))
    .filter((s) => {
      if (kind !== "op") return true;
      const stageFrente = (s as { frente_slug?: string | null }).frente_slug ?? null;
      if (!stageFrente) return true; // etapa comum — sempre visível
      // Etapa condicional: visível se é da frente filtrada, ou (sem/qualquer
      // filtro) se há caso nela.
      if (applyFrente && stageFrente === frenteFilter) return true;
      return casesInSlug(s.slug);
    })
    .map((s) => ({ id: s.slug, label: s.label, toneColor: roleColor(s.stage_role) }));

  function handleMove(id: string, toSlug: string) {
    const stage = (stages ?? []).find((s) => s.slug === toSlug);
    if (!stage) return;
    const mover = kind === "op" ? moveOp : moveFin;
    // ITEM 2 — passa `toSlug` para o optimistic update (card salta na hora).
    mover.mutate(
      { caseId: id, stageId: stage.id, toSlug },
      {
        onSuccess: () => toast.success(`Movido pra ${stage.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao mover"),
      },
    );
  }

  const total = cases.length;

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
      <Breadcrumb
        items={[
          { label: "Operação", to: "/hoje" },
          { label: "Pipeline Operacional" },
          { label: serviceType.name },
        ]}
      />
      <PageHeader
        eyebrow="Esteira"
        title={serviceType.name}
        subtitle={
          isLoading || stagesLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} em ${columns.length} etapas.`
        }
        aside={
          // Item 1 + 2 — toolbar compartilhada. No principal, "Editar etapas" abre
          // o StageEditor do operacional (etapas do principal). O dropdown
          // "Escolher kanban" lista principal + custom (sem Financeiro).
          <KanbanToolbar
            boards={boards}
            activeBoardId={null}
            onSelectBoard={onSelectBoard}
            search={search}
            onSearch={setSearch}
            onVerLista={() =>
              navigate({
                to: "/casos/lista",
                search: {
                  cat: serviceType.id,
                  catName: serviceType.name,
                  ...(frenteFilter ? { frente: frenteFilter } : {}),
                },
              })
            }
            onEditarEtapas={() => setEditorOpen(true)}
            onCriarKanban={canEditStages ? () => setBoardsManagerOpen(true) : undefined}
            onTrocarTipo={onBack}
          />
        }
      />

      <StageEditor
        serviceTypeId={serviceType.id}
        serviceTypeName={serviceType.name}
        kind={kind}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        canEdit={canEditStages}
      />

      {/* A3 — gestão de listas/boards do tema (criar/renomear/reordenar/excluir +
          etapas de cada lista custom). Admin-only. O board principal (espelho do
          operacional) não é editável aqui — suas etapas vivem em "Editar etapas". */}
      {canEditStages && (
        <BoardsManagerDialog
          serviceTypeId={serviceType.id}
          serviceTypeName={serviceType.name}
          principalBoardId={principalBoard?.id ?? null}
          open={boardsManagerOpen}
          onOpenChange={setBoardsManagerOpen}
        />
      )}

      {/* Painel de filtros dinâmicos (fixos + campos canônicos do tema) */}
      <CaseFiltersPanel
        temaId={temaId}
        cases={
          baseCases as ((typeof baseCases)[number] & {
            canonical_fields?: Record<string, unknown> | null;
          })[]
        }
        filters={panelFilters}
        onChange={setPanelFilters}
        frenteOptions={frenteOptions.map((s) => ({ slug: s, label: s }))}
        hideFixed={["etapaOp"]}
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar casos: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {!stagesLoading && columns.length === 0 ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Layers size={15} /> Este tipo ainda não tem etapas operacionais cadastradas.
          </AlertDescription>
        </Alert>
      ) : (
        <KanbanBoard
          columns={columns}
          items={cases ?? []}
          isLoading={isLoading || stagesLoading}
          getId={(c) => c.id}
          getColumn={(c) => (kind === "op" ? c.macrostatus_op : c.macrostatus_fin)}
          renderCard={(c) => <CaseCardReal caso={c} kind={kind} />}
          onMove={podeEditar ? handleMove : undefined}
        />
      )}
    </div>
  );
}

// A3 — tipo mínimo de um board (linha de system_pipeline_boards_active).
type BoardRow = {
  id: string;
  label: string;
  is_principal: boolean;
  ordem: number;
};

// Item 1 (2026-08-03) — "Escolher kanban": UM dropdown que lista TODOS os kanbans
// do tema (principal + custom) e troca a visão ao selecionar. NÃO inclui o
// Financeiro (o financeiro não faz parte dessa escolha). O botão mostra o kanban
// ativo. `activeBoardId=null` = kanban principal.
function KanbanDropdown({
  boards,
  activeBoardId,
  onSelect,
}: {
  boards: BoardRow[];
  activeBoardId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const principal = boards.find((b) => b.is_principal) ?? null;
  const custom = boards.filter((b) => !b.is_principal);
  const activeLabel =
    activeBoardId === null
      ? (principal?.label ?? "Principal")
      : (boards.find((b) => b.id === activeBoardId)?.label ?? "·");

  const item = (id: string | null, label: string) => {
    const active = activeBoardId === id;
    return (
      <DropdownMenuItem key={id ?? "__principal"} onClick={() => onSelect(id)} className="gap-2">
        <Check size={13} className={active ? "opacity-100 text-[var(--gold)]" : "opacity-0"} />
        <span className={active ? "font-medium text-[var(--navy)]" : ""}>{label}</span>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-[var(--card)] text-[var(--navy)] border border-[rgba(120,96,30,0.12)] hover:border-[var(--gold)] transition-colors"
          title="Escolher kanban"
        >
          <FolderKanban size={13} className="text-[var(--gold)]" />
          <span className="max-w-[160px] truncate">{activeLabel}</span>
          <ChevronDown size={13} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Escolher kanban
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {item(null, principal?.label ?? "Principal")}
        {custom.map((b) => item(b.id, b.label))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Item 2 (2026-08-03) — toolbar COMPARTILHADA do kanban (principal e custom têm
// PARIDADE): busca, dropdown "Escolher kanban", "Ver em lista", "Editar etapas",
// "Criar novo kanban" e "Trocar tipo". Extraída num único componente para garantir
// paridade e não duplicar lógica. Os handlers de cada botão vêm do chamador (no
// custom, "Editar etapas" edita as etapas DAQUELE board).
function KanbanToolbar({
  boards,
  activeBoardId,
  onSelectBoard,
  search,
  onSearch,
  searchPlaceholder = "Buscar cliente, código, município…",
  onVerLista,
  onEditarEtapas,
  onCriarKanban,
  onTrocarTipo,
}: {
  boards: BoardRow[];
  activeBoardId: string | null;
  onSelectBoard: (id: string | null) => void;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  onVerLista: () => void;
  onEditarEtapas: () => void;
  onCriarKanban?: () => void;
  onTrocarTipo: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gold)]"
        />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-56 pl-8 pr-3 py-1.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12px] focus:border-[var(--gold)] outline-none"
        />
      </div>
      <KanbanDropdown boards={boards} activeBoardId={activeBoardId} onSelect={onSelectBoard} />
      <Btn variant="ghost" onClick={onVerLista}>
        <List size={14} />
        Ver em lista
      </Btn>
      <Btn variant="ghost" onClick={onEditarEtapas}>
        <Settings2 size={14} />
        Editar etapas
      </Btn>
      {onCriarKanban && (
        <Btn variant="ghost" onClick={onCriarKanban}>
          <Plus size={14} />
          Criar novo kanban
        </Btn>
      )}
      <Btn variant="ghost" onClick={onTrocarTipo}>
        <ArrowLeft size={14} />
        Trocar tipo
      </Btn>
    </div>
  );
}

// A3 — Kanban de um board CUSTOM. Etapas próprias (system_pipeline_stages.board_id)
// + posições próprias (system_case_board_positions). Campos/filtros continuam do
// TEMA (mesmos do principal): AJUSTE #2 (item 3) — renderizamos o MESMO
// CaseFiltersPanel do principal (defs do tema) e o botão "Editar campos" edita os
// defs do TEMA. NÃO há storage de filtro por board (a fonte é system_tema_field_defs
// por tema, compartilhada). Busca rápida por cliente/código também.
function CustomBoardKanban({
  serviceType,
  board,
  boards,
  onSelectBoard,
  onBack,
}: {
  serviceType: { id: string; name: string };
  board: BoardRow;
  boards: BoardRow[];
  onSelectBoard: (id: string | null) => void;
  onBack: () => void;
}) {
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");
  const podeEditar = usePodeEditar("operacional");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [boardsManagerOpen, setBoardsManagerOpen] = useState(false);
  // TAREFA A (2026-08-04) — "Editar etapas" no kanban CUSTOM abre o MESMO
  // StageEditor do principal, porém escopado a ESTE board (boardId={board.id}):
  // reordenar/renomear/papel/excluir + "Nova etapa" + a setinha do checklist por
  // etapa. "Criar novo kanban" segue abrindo o BoardsManagerDialog.
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  // AJUSTE #2 (item 3) — mesmo painel de filtros do principal (defs do TEMA).
  const [panelFilters, setPanelFilters] = useState<CaseFilterValues>({
    etapaOp: "",
    etapaFin: "",
    responsavel: "",
    municipio: "",
    frente: "",
    caso: "",
    canonical: {},
  });

  const { data: stages, isLoading: stagesLoading } = useBoardStages(board.id);
  const { data: cases, isLoading } = useCasesByBoard(board.id);
  const move = useMoveCaseInBoard(board.id);
  const principalBoard = boards.find((b) => b.is_principal) ?? null;

  // Resolve o tema_id do service_type (lookup reverso) — os filtros são do TEMA.
  const { data: temas } = useTemas();
  const temaId = useMemo(() => {
    for (const t of temas ?? []) {
      if ((t as { service_type_id?: string | null }).service_type_id === serviceType.id)
        return t.id;
    }
    return null;
  }, [temas, serviceType.id]);
  const { data: temaDefsData } = useTemaFieldDefs(temaId);
  const temaFilterDefs = useMemo(
    () =>
      ((temaDefsData ?? []) as { key: string; type: string; scope?: string }[]).map((d) => ({
        key: d.key,
        type: d.type,
        scope: d.scope,
      })),
    [temaDefsData],
  );

  const boardCases = (cases ?? []) as (NonNullable<typeof cases>[number] & {
    canonical_fields?: Record<string, unknown> | null;
  })[];
  // Aplica os filtros do TEMA (mesma função do principal), depois a busca rápida.
  const afterPanel = applyCaseFilters(boardCases, panelFilters, temaFilterDefs);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? afterPanel.filter((c) => {
        const nome = (c as { client_name?: string | null }).client_name ?? "";
        const code = (c as { case_code?: string | null }).case_code ?? "";
        return nome.toLowerCase().includes(q) || code.toLowerCase().includes(q);
      })
    : afterPanel;

  const columns: KanbanColumn<string>[] = (stages ?? []).map((s) => ({
    id: s.slug,
    label: s.label,
    toneColor: roleColor(s.stage_role),
  }));

  function handleMove(id: string, toSlug: string) {
    const stage = (stages ?? []).find((s) => s.slug === toSlug);
    if (!stage) return;
    move.mutate(
      { caseId: id, stageId: stage.id, toSlug },
      {
        onSuccess: () => toast.success(`Movido pra ${stage.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao mover"),
      },
    );
  }

  const total = filtered.length;

  return (
    <div className="px-5 lg:px-7 pt-7 pb-10">
      <Breadcrumb
        items={[
          { label: "Operação", to: "/hoje" },
          { label: "Pipeline Operacional" },
          { label: serviceType.name },
          { label: board.label },
        ]}
      />
      <PageHeader
        eyebrow={`Lista · ${serviceType.name}`}
        title={board.label}
        subtitle={
          isLoading || stagesLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} em ${columns.length} etapas.`
        }
        aside={
          // Item 2 — PARIDADE com o principal: mesma toolbar. TAREFA A — "Editar
          // etapas" abre o MESMO StageEditor do principal, escopado a ESTE board
          // (etapas deste kanban custom + checklist por etapa). "Criar novo kanban"
          // abre o BoardsManagerDialog. "Ver em lista" leva à Lista do tema;
          // "Trocar tipo" volta à seleção.
          <KanbanToolbar
            boards={boards}
            activeBoardId={board.id}
            onSelectBoard={onSelectBoard}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Buscar cliente, código…"
            onVerLista={() =>
              navigate({
                to: "/casos/lista",
                search: { cat: serviceType.id, catName: serviceType.name, board: board.id },
              })
            }
            onEditarEtapas={() => setStageEditorOpen(true)}
            onCriarKanban={canEditStages ? () => setBoardsManagerOpen(true) : undefined}
            onTrocarTipo={onBack}
          />
        }
      />

      {/* TAREFA A — MESMO editor do principal, porém escopado a ESTE board
          (boardId={board.id}). Lê/edita as etapas do board via board-service e
          expõe o checklist por etapa (chaveado por service_type_id + stage_slug). */}
      <StageEditor
        serviceTypeId={serviceType.id}
        serviceTypeName={board.label}
        kind="op"
        boardId={board.id}
        open={stageEditorOpen}
        onOpenChange={setStageEditorOpen}
        canEdit={canEditStages}
      />

      {canEditStages && (
        <BoardsManagerDialog
          serviceTypeId={serviceType.id}
          serviceTypeName={serviceType.name}
          principalBoardId={principalBoard?.id ?? null}
          open={boardsManagerOpen}
          onOpenChange={setBoardsManagerOpen}
        />
      )}

      {/* AJUSTE #2 (item 3) — MESMO painel de filtros do TEMA (defs compartilhados).
          "Editar campos" (dentro do painel) edita os defs do tema, refletindo em
          todos os kanbans. Sem storage de filtro por board. */}
      <CaseFiltersPanel
        temaId={temaId}
        cases={boardCases}
        filters={panelFilters}
        onChange={setPanelFilters}
        hideFixed={["etapaOp", "etapaFin", "frente"]}
      />

      {!stagesLoading && columns.length === 0 ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Layers size={15} /> Esta lista ainda não tem etapas. Adicione em "Gerenciar listas".
          </AlertDescription>
        </Alert>
      ) : (
        <KanbanBoard
          columns={columns}
          items={filtered}
          isLoading={isLoading || stagesLoading}
          getId={(c) => c.id}
          getColumn={(c) => (c as { board_stage_slug?: string | null }).board_stage_slug ?? ""}
          renderCard={(c) => <CaseCardReal caso={c} kind="op" />}
          onMove={podeEditar ? handleMove : undefined}
        />
      )}
    </div>
  );
}
