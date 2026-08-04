import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  FolderKanban,
  Layers,
  List,
  Pencil,
  Plus,
  Search,
  Settings2,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCasesByServiceType,
  useMoveCaseStageFin,
  useMoveCaseStageOp,
  useStages,
} from "@/hooks/usePipeline";
import { useBoards, useBoardStages, useCasesByBoard, useMoveCaseInBoard } from "@/hooks/useBoards";
import { BoardsManagerDialog } from "@/components/pipeline/BoardsManagerDialog";
import { usePodeEditar } from "@/hooks/usePermissions";
import { useTemaFieldDefs } from "@/hooks/useTemaFieldDefs";
import { useTemas } from "@/hooks/useTemas";
import { useSetTypeTemplatesFolder } from "@/hooks/useDocumentTemplates";

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
  const { cat, catName, frente, board } = Route.useSearch();
  const navigate = useNavigate();

  const onPick = (t: { id: string; name: string }) =>
    navigate({ to: "/pipeline", search: { cat: t.id, catName: t.name } });
  const onBack = () => navigate({ to: "/pipeline", search: {} });

  if (cat) {
    return (
      <DynamicKanban
        serviceType={{ id: cat, name: catName ?? "—" }}
        initialFrente={frente ?? ""}
        boardId={board ?? null}
        onBack={onBack}
      />
    );
  }
  return <ServiceTypeSelection onPick={onPick} />;
}

function ServiceTypeSelection({ onPick }: { onPick: (t: { id: string; name: string }) => void }) {
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
                  onClick={() => stId && onPick({ id: stId, name: t.name })}
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
        acessíveis pela Lista de casos — vincule-os a um tema pela ficha do caso.
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
  const activeBoard = boardId ? ((boards ?? []).find((b) => b.id === boardId) ?? null) : null;
  const selectBoard = (id: string | null) =>
    navigate({
      to: "/pipeline",
      search: {
        cat: serviceType.id,
        catName: serviceType.name,
        ...(id ? { board: id } : {}),
      },
    });

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
  // A3 — gate RBAC do board Financeiro no seletor (entrada especial oculta sem módulo).
  const podeFinanceiro = can(role, "financeiro.manage");
  const [editorOpen, setEditorOpen] = useState(false);
  // Ponto 6 — vincular/trocar a pasta de modelos deste tipo (caso).
  const setFolder = useSetTypeTemplatesFolder();
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderInput, setFolderInput] = useState("");

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
          <div className="flex items-center gap-2">
            {/* Busca rápida por cliente/código no Kanban. */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gold)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, código, município…"
                className="w-56 pl-8 pr-3 py-1.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12px] focus:border-[var(--gold)] outline-none"
              />
            </div>
            {/* A3 — seletor de board/lista do tema (principal + custom). O
                financeiro é uma entrada gateada por RBAC. */}
            <BoardSelector
              boards={boards}
              activeBoardId={null}
              onSelect={onSelectBoard}
              onManage={canEditStages ? () => setBoardsManagerOpen(true) : undefined}
              onFinanceiro={
                podeFinanceiro ? () => navigate({ to: "/casos/financeiro" }) : undefined
              }
            />
            {/* R2-08 — alterna Kanban→Lista no contexto da categoria, levando a
                frente ativa (a Lista filtra pelo MESMO service_type_id do board). */}
            <Btn
              variant="ghost"
              onClick={() =>
                navigate({
                  to: "/casos/lista",
                  search: {
                    cat: serviceType.id,
                    catName: serviceType.name,
                    ...(frenteFilter ? { frente: frenteFilter } : {}),
                  },
                })
              }
            >
              <List size={14} />
              Ver em lista
            </Btn>
            <Btn variant="ghost" onClick={() => setEditorOpen(true)}>
              <Settings2 size={14} />
              Editar etapas
            </Btn>
            {canEditStages && (
              <Btn
                variant="ghost"
                onClick={() => {
                  setFolderInput("");
                  setFolderOpen(true);
                }}
              >
                <FolderKanban size={14} />
                Pasta de modelos
              </Btn>
            )}
            <Btn variant="ghost" onClick={onBack}>
              <ArrowLeft size={14} />
              Trocar tipo
            </Btn>
          </div>
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

      {/* Ponto 6 — vincular/trocar a pasta de modelos (procuração/caso) deste tipo */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pasta de modelos — {serviceType.name}</DialogTitle>
            <DialogDescription>
              Cole o link (ou o ID) da pasta do Google Drive com os modelos deste caso. Ao salvar,
              os modelos dessa pasta são sincronizados e passam a aparecer ao gerar o documento
              deste tipo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Link ou ID da pasta do Drive</Label>
            <Input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolderOpen(false)}
              disabled={setFolder.isPending}
            >
              Cancelar
            </Button>
            <Button
              disabled={!folderInput.trim() || setFolder.isPending}
              onClick={async () => {
                try {
                  const res = await setFolder.mutateAsync({
                    serviceTypeId: serviceType.id,
                    folder: folderInput.trim(),
                  });
                  toast.success(
                    `Pasta vinculada — ${res.created} novos, ${res.updated} atualizados, ${res.skipped} já existiam` +
                      (res.errors.length ? ` | ${res.errors.length} erros` : ""),
                  );
                  setFolderOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha ao vincular a pasta");
                }
              }}
            >
              {setFolder.isPending ? "Sincronizando…" : "Salvar e sincronizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

// A3 — seletor de board/lista (segmented). Principal + boards custom + engrenagem
// (gestão, admin) + entrada Financeiro gateada por RBAC.
function BoardSelector({
  boards,
  activeBoardId,
  onSelect,
  onManage,
  onFinanceiro,
}: {
  boards: BoardRow[];
  activeBoardId: string | null;
  onSelect: (id: string | null) => void;
  onManage?: () => void;
  onFinanceiro?: () => void;
}) {
  const principal = boards.find((b) => b.is_principal) ?? null;
  const custom = boards.filter((b) => !b.is_principal);
  // Sem boards custom e sem gestão/financeiro não há o que escolher — some.
  if (custom.length === 0 && !onManage && !onFinanceiro) return null;

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
      active
        ? "bg-[var(--navy)] text-white"
        : "bg-[var(--card)] text-[var(--navy)] border border-[rgba(120,96,30,0.12)] hover:border-[var(--gold)]"
    }`;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={pill(activeBoardId === null)}
        onClick={() => onSelect(null)}
        title="Board principal (operacional)"
      >
        {principal?.label ?? "Principal"}
      </button>
      {custom.map((b) => (
        <button
          key={b.id}
          type="button"
          className={pill(activeBoardId === b.id)}
          onClick={() => onSelect(b.id)}
        >
          {b.label}
        </button>
      ))}
      {onFinanceiro && (
        <button
          type="button"
          className={pill(false)}
          onClick={onFinanceiro}
          title="Board financeiro (reservado)"
        >
          Financeiro
        </button>
      )}
      {onManage && (
        <button
          type="button"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-[var(--navy)] transition-colors"
          onClick={onManage}
          title="Gerenciar listas do tema"
        >
          <Settings2 size={14} />
        </button>
      )}
    </div>
  );
}

// A3 — Kanban de um board CUSTOM. Etapas próprias (system_pipeline_stages.board_id)
// + posições próprias (system_case_board_positions). Campos/filtros continuam do
// TEMA (mesmos do principal), então NÃO reintroduzimos um painel de filtros próprio
// (regra dura: filtros não mudam por board). Busca rápida por cliente/código.
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
  const podeFinanceiro = can(role, "financeiro.manage");
  const podeEditar = usePodeEditar("operacional");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [boardsManagerOpen, setBoardsManagerOpen] = useState(false);

  const { data: stages, isLoading: stagesLoading } = useBoardStages(board.id);
  const { data: cases, isLoading } = useCasesByBoard(board.id);
  const move = useMoveCaseInBoard(board.id);
  const principalBoard = boards.find((b) => b.is_principal) ?? null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? (cases ?? []).filter((c) => {
        const nome = (c as { client_name?: string | null }).client_name ?? "";
        const code = (c as { case_code?: string | null }).case_code ?? "";
        return nome.toLowerCase().includes(q) || code.toLowerCase().includes(q);
      })
    : (cases ?? []);

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
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gold)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, código…"
                className="w-52 pl-8 pr-3 py-1.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[12px] focus:border-[var(--gold)] outline-none"
              />
            </div>
            <BoardSelector
              boards={boards}
              activeBoardId={board.id}
              onSelect={onSelectBoard}
              onManage={canEditStages ? () => setBoardsManagerOpen(true) : undefined}
              onFinanceiro={
                podeFinanceiro ? () => navigate({ to: "/casos/financeiro" }) : undefined
              }
            />
            <Btn variant="ghost" onClick={onBack}>
              <ArrowLeft size={14} />
              Trocar tipo
            </Btn>
          </div>
        }
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
