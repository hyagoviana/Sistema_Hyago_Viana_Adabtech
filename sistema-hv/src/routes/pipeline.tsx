import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, FolderKanban, Layers, List, Pencil, Plus, Settings2, Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { CaseCardReal } from "@/components/cases/CaseCardReal";
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
import { usePodeEditar } from "@/hooks/usePermissions";
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
  const { cat, catName, frente } = Route.useSearch();
  const navigate = useNavigate();

  const onPick = (t: { id: string; name: string }) =>
    navigate({ to: "/pipeline", search: { cat: t.id, catName: t.name } });
  const onBack = () => navigate({ to: "/pipeline", search: {} });

  if (cat) {
    return (
      <DynamicKanban
        serviceType={{ id: cat, name: catName ?? "—" }}
        initialFrente={frente ?? ""}
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

function DynamicKanban({
  serviceType,
  initialFrente = "",
  onBack,
}: {
  serviceType: { id: string; name: string };
  initialFrente?: string;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"op" | "fin">("op");
  // R2-05 — filtro por FRENTE (só operacional). "" = todas as frentes.
  // R2-08 — semeado por ?frente= ao voltar da Lista via toggle.
  const [frenteFilter, setFrenteFilter] = useState<string>(initialFrente);
  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, kind);
  const { data: allCases, isLoading, isError, error } = useCasesByServiceType(serviceType.id);
  const moveOp = useMoveCaseStageOp(serviceType.id);
  const moveFin = useMoveCaseStageFin(serviceType.id);
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");
  const podeEditar = usePodeEditar("operacional");
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
      : (allCases ?? []).filter(
          (c) =>
            !(c as { removido_do_operacional_at?: string | null }).removido_do_operacional_at &&
            // Melhoria 3: casos em fase comercial (aguardando assinatura) não
            // aparecem no Kanban operacional até serem liberados.
            !(c as { aguardando_assinatura_at?: string | null }).aguardando_assinatura_at,
        );

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

  // R2-05 — o filtro de frente só se aplica ao operacional (etapas condicionais por
  // frente são um conceito op). No financeiro, ignora.
  const applyFrente = kind === "op" && frenteFilter !== "";
  const cases = applyFrente ? baseCases.filter((c) => caseFrente(c) === frenteFilter) : baseCases;

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
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
              {(["op", "fin"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={
                    kind === k
                      ? "px-3 py-1.5 bg-[var(--navy)] text-white"
                      : "px-3 py-1.5 text-muted-foreground hover:bg-[var(--muted)]"
                  }
                >
                  {k === "op" ? "Operacional" : "Financeiro"}
                </button>
              ))}
            </div>
            {/* R2-05 — filtro por FRENTE (só no operacional; oculta colunas
                condicionais de outras frentes quando uma frente é escolhida). */}
            {kind === "op" && frenteOptions.length > 0 && (
              <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
                <button
                  type="button"
                  onClick={() => setFrenteFilter("")}
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
                    key={fr}
                    type="button"
                    onClick={() => setFrenteFilter(fr)}
                    className={
                      frenteFilter === fr
                        ? "px-3 py-1.5 bg-[var(--gold)] text-white"
                        : "px-3 py-1.5 text-muted-foreground hover:bg-[var(--muted)] border-l border-[var(--border)]"
                    }
                  >
                    {fr}
                  </button>
                ))}
              </div>
            )}
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
