import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, FolderKanban, Layers, Pencil, Plus, Settings2, Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { CaseCardReal } from "@/components/cases/CaseCardReal";
import { CaseFormDialog } from "@/components/cases/CaseFormDialog";
import { CategoryFoldersEditor } from "@/components/pipeline/CategoryFoldersEditor";
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
  useCreateServiceType,
  useDeleteServiceType,
  useMoveCaseStageFin,
  useMoveCaseStageOp,
  useServiceTypes,
  useStages,
  useUpdateServiceType,
} from "@/hooks/usePipeline";
import { useSetTypeTemplatesFolder } from "@/hooks/useDocumentTemplates";

function slugifyCat(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// (item 2, 2026-07-09) — a categoria selecionada vive na URL (search param `cat`).
// Assim, clicar em "Pipeline Operacional" no menu (Link sem search) VOLTA ao
// seletor de categorias — mesmo padrão do financeiro.
const searchSchema = z.object({
  cat: z.string().uuid().optional().catch(undefined),
  catName: z.string().optional().catch(undefined),
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
  const { cat, catName } = Route.useSearch();
  const navigate = useNavigate();

  const onPick = (t: { id: string; name: string }) =>
    navigate({ to: "/pipeline", search: { cat: t.id, catName: t.name } });
  const onBack = () => navigate({ to: "/pipeline", search: {} });

  if (cat) {
    return <DynamicKanban serviceType={{ id: cat, name: catName ?? "—" }} onBack={onBack} />;
  }
  return <ServiceTypeSelection onPick={onPick} />;
}

function ServiceTypeSelection({ onPick }: { onPick: (t: { id: string; name: string }) => void }) {
  const { data: types, isLoading } = useServiceTypes();
  const createCat = useCreateServiceType();
  const updateCat = useUpdateServiceType();
  const deleteCat = useDeleteServiceType();
  const { role } = useAuth();
  const canManage = can(role, "config.manage");

  async function excluirCategoria() {
    if (!renaming) return;
    if (
      !window.confirm(
        `Excluir a categoria "${renaming.name}"?\n\nIsto remove as etapas, os modelos e as pastas do Drive vinculadas. Só é possível se não houver casos vinculados. Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      await deleteCat.mutateAsync(renaming.id);
      toast.success("Categoria excluída");
      setRenaming(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir categoria");
    }
  }
  const [newOpen, setNewOpen] = useState(false);
  const [createCaseOpen, setCreateCaseOpen] = useState(false);
  // R2-06 — gestão de TEMAS/FRENTES (admin-only).
  const [temasOpen, setTemasOpen] = useState(false);
  const [catName, setCatName] = useState("");
  // Renomear um tipo existente (grava name no banco).
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function criarCategoria() {
    const name = catName.trim();
    if (!name) return;
    try {
      const created = await createCat.mutateAsync({
        name,
        slug: slugifyCat(name) || `CAT_${(types?.length ?? 0) + 1}`,
      });
      toast.success("Categoria criada — agora vincule os documentos de caso e procurações");
      setCatName("");
      setNewOpen(false);
      // Abre o editor da categoria recém-criada para já subir os modelos.
      if (created?.id) {
        setRenaming({ id: created.id, name: created.name });
        setRenameValue(created.name);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar categoria");
    }
  }

  async function salvarNome() {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name || name === renaming.name) return;
    try {
      await updateCat.mutateAsync({ id: renaming.id, patch: { name } });
      toast.success("Nome da categoria atualizado");
      // Mantém o editor aberto (o usuário pode continuar vinculando pastas).
      setRenaming({ id: renaming.id, name });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao renomear");
    }
  }

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Pipeline Operacional" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Operacional"
        subtitle="Escolha o tipo de caso para abrir a esteira específica."
        aside={
          <div className="flex items-center gap-2">
            <Btn variant="gold" onClick={() => setCreateCaseOpen(true)}>
              <Plus size={14} />
              Novo caso
            </Btn>
            <Btn variant="ghost" onClick={() => setNewOpen(true)}>
              <Plus size={14} />
              Nova categoria
            </Btn>
            {canManage && (
              <Btn variant="ghost" onClick={() => setTemasOpen(true)}>
                <Tag size={14} />
                Temas
              </Btn>
            )}
          </div>
        }
      />

      {/* R2-06 — gestão de temas/frentes (admin-only, gate acima) */}
      {canManage && <TemasManagerDialog open={temasOpen} onOpenChange={setTemasOpen} />}

      <CaseFormDialog open={createCaseOpen} onOpenChange={setCreateCaseOpen} />

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria de pipeline</DialogTitle>
            <DialogDescription>
              Crie uma nova esteira (ex.: Trabalhista, Possessória). Ela nasce com etapas padrão que
              você edita depois.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nome da categoria</Label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Ex.: Trabalhista"
              onKeyDown={(e) => e.key === "Enter" && criarCategoria()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criarCategoria} disabled={createCat.isPending || !catName.trim()}>
              {createCat.isPending ? "Criando…" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando casos…</div>
      ) : (types ?? []).length === 0 ? (
        <Alert>
          <AlertDescription>Nenhum tipo de caso cadastrado.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(types ?? []).map((t) => (
            <div
              key={t.id}
              className="card-hero relative p-6 hover:border-[var(--gold)] transition-colors group"
            >
              <button
                type="button"
                onClick={() => onPick({ id: t.id, name: t.name })}
                className="flex items-center gap-3 text-left w-full"
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}
                >
                  <FolderKanban size={20} />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-[var(--navy)]">{t.name}</div>
                  <div className="text-[12px] text-muted-foreground">Abrir esteira →</div>
                </div>
              </button>
              {canManage && (
                <button
                  type="button"
                  title="Renomear pipeline"
                  onClick={() => {
                    setRenaming({ id: t.id, name: t.name });
                    setRenameValue(t.name);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-[var(--muted)] hover:text-[var(--navy)] transition-opacity"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Renomear pipeline (grava system_service_types.name no banco) */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
            <DialogDescription>
              Renomeie a categoria e vincule os modelos de documento de caso e de procuração. Tudo é
              salvo no banco e no Drive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da categoria</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvarNome()}
                />
                <Button
                  variant="outline"
                  onClick={salvarNome}
                  disabled={
                    updateCat.isPending ||
                    !renameValue.trim() ||
                    renameValue.trim() === renaming?.name
                  }
                >
                  {updateCat.isPending ? "Salvando…" : "Salvar nome"}
                </Button>
              </div>
            </div>

            {renaming && <CategoryFoldersEditor serviceTypeId={renaming.id} />}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={excluirCategoria}
              disabled={deleteCat.isPending}
            >
              {deleteCat.isPending ? "Excluindo…" : "Excluir categoria"}
            </Button>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DynamicKanban({
  serviceType,
  onBack,
}: {
  serviceType: { id: string; name: string };
  onBack: () => void;
}) {
  const [kind, setKind] = useState<"op" | "fin">("op");
  const { data: stages, isLoading: stagesLoading } = useStages(serviceType.id, kind);
  const { data: allCases, isLoading, isError, error } = useCasesByServiceType(serviceType.id);
  const moveOp = useMoveCaseStageOp(serviceType.id);
  const moveFin = useMoveCaseStageFin(serviceType.id);
  const { role } = useAuth();
  const canEditStages = can(role, "config.manage");
  const [editorOpen, setEditorOpen] = useState(false);
  // Ponto 6 — vincular/trocar a pasta de modelos deste tipo (caso).
  const setFolder = useSetTypeTemplatesFolder();
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderInput, setFolderInput] = useState("");

  // Financeiro mostra só casos bifurcados (com etapa financeira ativa).
  // Operacional esconde os casos "somente financeiro" (S19 / ADR-016) — filtro SÓ aqui,
  // nunca na fonte/view, senão o caso sumiria das duas pipelines.
  const cases =
    kind === "fin"
      ? (allCases ?? []).filter((c) => c.macrostatus_fin && c.macrostatus_fin !== "NAO_APLICAVEL")
      : (allCases ?? []).filter(
          (c) =>
            !(c as { removido_do_operacional_at?: string | null }).removido_do_operacional_at &&
            // Melhoria 3: casos em fase comercial (aguardando assinatura) não
            // aparecem no Kanban operacional até serem liberados.
            !(c as { aguardando_assinatura_at?: string | null }).aguardando_assinatura_at,
        );

  const columns: KanbanColumn<string>[] = (stages ?? [])
    .filter((s) => !(kind === "fin" && s.slug === "NAO_APLICAVEL"))
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
          onMove={handleMove}
        />
      )}
    </div>
  );
}
