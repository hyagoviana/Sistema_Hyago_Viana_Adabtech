// #2 (2026-08-17) — Workflows / automações. Builder "Criar workflow": Gatilho → Ações.
// Gatilhos cabeados: status_changed (mover etapa), checklist_completed (fechar checklist
// da etapa), task_created e task_completed. Ao escolher um tema, um seletor de KANBAN
// (Principal/Financeiro/custom) define de qual kanban as etapas do gatilho são puxadas;
// em "Todos os temas" os campos de etapa caem para texto livre.
//
// Gate: sistema (view p/ ver; edit p/ criar/editar/excluir) — herda dos RPCs.

import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Breadcrumb, PageHeader, Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWorkflowRules,
  useCreateWorkflowRule,
  useUpdateWorkflowRule,
  useDeleteWorkflowRule,
} from "@/hooks/useWorkflows";
import { useTemas } from "@/hooks/useTemas";
import { useStages } from "@/hooks/usePipeline";
import { useBoards, useBoardStages } from "@/hooks/useBoards";
import { usePodeEditar } from "@/hooks/usePermissions";
import { TaskTypePicker } from "@/components/hv/TaskTypePicker";

export const Route = createFileRoute("/configuracoes/workflows")({
  component: WorkflowsPage,
});

type TriggerType = "status_changed" | "checklist_completed" | "task_created" | "task_completed";
type ActionType = "write_comment" | "create_task" | "move_stage";
type Action = {
  type: ActionType;
  body?: string;
  title?: string;
  due_days?: number;
  to_stage_slug?: string;
  // AJ3 (27/08) — em qual kanban a ação move: "op" (padrão) | "fin" | boardId.
  // Ausente = "op", para que toda regra criada antes disto continue igual.
  board_key?: string;
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  status_changed: "Mudou de etapa",
  checklist_completed: "Checklist da etapa concluído",
  task_created: "Tarefa criada",
  task_completed: "Tarefa concluída",
};
const ACTION_LABELS: Record<ActionType, string> = {
  write_comment: "Escrever comentário",
  create_task: "Criar tarefa",
  move_stage: "Mudar etapa",
};

// Dedupe de etapas por slug (um slug pode existir em op+fin; junta os rótulos).
function dedupeStages(arr: Array<{ slug: string; label: string }> | undefined) {
  const seen = new Map<string, string>();
  for (const s of arr ?? []) {
    const prev = seen.get(s.slug);
    seen.set(s.slug, prev && prev !== s.label ? `${prev} / ${s.label}` : s.label);
  }
  return Array.from(seen, ([slug, label]) => ({ slug, label }));
}

// Campo de etapa: vira dropdown quando há etapas do tema; senão, texto livre
// (caso "Todos os temas", onde não dá para resolver o service_type).
function StageField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ slug: string; label: string }>;
  placeholder: string;
}) {
  if (options.length === 0) {
    return (
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((s) => (
          <SelectItem key={s.slug} value={s.slug}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// AJ3 — campos da ação "Mudar etapa": PRIMEIRO o kanban, depois a etapa dele.
// Componente proprio porque cada ação pode apontar para um kanban diferente, e
// as etapas de um kanban custom exigem uma query por board (useBoardStages).
// Fica fora de WorkflowsPage para que o hook rode por ação, não por formulário.
function MoveStageActionFields({
  boardKey,
  stageSlug,
  onChange,
  kanbanOptions,
  opStages,
  finStages,
}: {
  boardKey: string;
  stageSlug: string;
  onChange: (patch: { board_key?: string; to_stage_slug?: string }) => void;
  kanbanOptions: Array<{ key: string; label: string }>;
  opStages: Array<{ slug: string; label: string }> | undefined;
  finStages: Array<{ slug: string; label: string }> | undefined;
}) {
  const customBoardId = boardKey === "op" || boardKey === "fin" ? null : boardKey;
  const { data: boardStages } = useBoardStages(customBoardId);

  const options = useMemo(() => {
    if (boardKey === "op") return dedupeStages(opStages);
    if (boardKey === "fin") return dedupeStages(finStages);
    return dedupeStages(boardStages as never);
  }, [boardKey, opStages, finStages, boardStages]);

  const nomeKanban = kanbanOptions.find((k) => k.key === boardKey)?.label ?? "Kanban Principal";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Select
        value={boardKey}
        onValueChange={(v) => {
          // Trocar de kanban invalida a etapa escolhida: os slugs são por kanban.
          onChange({ board_key: v, to_stage_slug: "" });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Kanban" />
        </SelectTrigger>
        <SelectContent>
          {kanbanOptions.map((k) => (
            <SelectItem key={k.key} value={k.key}>
              {k.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <StageField
          value={stageSlug}
          onChange={(v) => onChange({ to_stage_slug: v })}
          options={options}
          placeholder={`Etapa destino (${nomeKanban})`}
        />
        <p className="text-[11px] text-muted-foreground">Move em {nomeKanban}.</p>
      </div>
    </div>
  );
}

function WorkflowsPage() {
  const podeEditar = usePodeEditar("sistema");
  const { data: rules, isLoading } = useWorkflowRules();
  const { data: temas } = useTemas();
  const create = useCreateWorkflowRule();
  const update = useUpdateWorkflowRule();
  const del = useDeleteWorkflowRule();

  const [open, setOpen] = useState(false);
  // W1 — mesmo formulário serve para criar e EDITAR (o serviço já tinha update;
  // faltava a tela). `editandoId` null = criando.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [grupo, setGrupo] = useState("");
  // Filtros da lista (quando todos os temas entrarem, sem isto não se acha nada).
  const [busca, setBusca] = useState("");
  const [filtroTema, setFiltroTema] = useState("__all__");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "ativos" | "suspensos">("todos");
  const [temaId, setTemaId] = useState<string>("__all__");
  const [trigger, setTrigger] = useState<TriggerType>("status_changed");
  // Kanban de onde as etapas do gatilho são puxadas: "op" | "fin" | boardId (custom).
  const [triggerKanban, setTriggerKanban] = useState<string>("op");
  // Pedido A — tipo de tarefa que ativa o gatilho (task_created/task_completed).
  const [taskTypeId, setTaskTypeId] = useState<string>("");
  const [stageSlug, setStageSlug] = useState("");
  const [actions, setActions] = useState<Action[]>([{ type: "write_comment", body: "" }]);

  const temaList = useMemo(
    () =>
      (temas as Array<{ id: string; name: string; service_type_id?: string | null }> | undefined) ??
      [],
    [temas],
  );

  // W1 — filtra e ORDENA por grupo (o cabeçalho de grupo é desenhado quando o
  // valor muda, então a ordenação é o que faz o agrupamento existir).
  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = (rules ?? []).filter((r) => {
      const okTexto =
        !termo ||
        r.name.toLowerCase().includes(termo) ||
        (r.code ?? "").toLowerCase().includes(termo);
      const okTema = filtroTema === "__all__" || r.tema_id === filtroTema;
      const okEstado =
        filtroEstado === "todos" || (filtroEstado === "ativos" ? r.active : !r.active);
      return okTexto && okTema && okEstado;
    });
    return [...base].sort(
      (a, b) =>
        (a.group_name ?? "￿").localeCompare(b.group_name ?? "￿", "pt-BR") ||
        (a.code ?? "").localeCompare(b.code ?? "", "pt-BR"),
    );
  }, [rules, busca, filtroTema, filtroEstado]);

  // Etapas do tema selecionado (op + fin) para os dropdowns. Em "Todos os temas"
  // não há service_type → os campos de etapa caem para texto livre.
  const serviceTypeId = useMemo(
    () =>
      temaId === "__all__" ? "" : (temaList.find((t) => t.id === temaId)?.service_type_id ?? ""),
    [temaId, temaList],
  );
  const { data: opStages } = useStages(serviceTypeId, "op");
  const { data: finStages } = useStages(serviceTypeId, "fin");
  const { data: boards } = useBoards(serviceTypeId);

  // Kanbans do tema: Principal (op) + Financeiro (fin) + kanbans custom (boards).
  const kanbanOptions = useMemo(() => {
    const custom = ((boards ?? []) as Array<{ id: string; label: string; is_principal?: boolean }>)
      .filter((b) => !b.is_principal)
      .map((b) => ({ key: b.id, label: b.label }));
    return [
      { key: "op", label: "Kanban Principal" },
      { key: "fin", label: "Financeiro" },
      ...custom,
    ];
  }, [boards]);

  // Etapas do kanban custom selecionado (quando triggerKanban é um boardId).
  const customBoardId = triggerKanban === "op" || triggerKanban === "fin" ? null : triggerKanban;
  const { data: boardStages } = useBoardStages(customBoardId);

  // Etapas do GATILHO conforme o kanban escolhido.
  const triggerStageOptions = useMemo(() => {
    if (triggerKanban === "op") return dedupeStages(opStages as never);
    if (triggerKanban === "fin") return dedupeStages(finStages as never);
    return dedupeStages(boardStages as never);
  }, [triggerKanban, opStages, finStages, boardStages]);

  // Pedido A — tipos de tarefa (sub-opção dos gatilhos de tarefa).

  function reset() {
    setEditandoId(null);
    setName("");
    setGrupo("");
    setTemaId("__all__");
    setTrigger("status_changed");
    setTriggerKanban("op");
    setTaskTypeId("");
    setStageSlug("");
    setActions([{ type: "write_comment", body: "" }]);
    setOpen(false);
  }

  // Carrega uma regra existente no formulário (W1 — "e aí uma opção de editar ou
  // suspender… esse aqui, por exemplo, eu quero mexer nele para editar").
  function editar(r: {
    id: string;
    name: string;
    group_name: string | null;
    tema_id: string | null;
    trigger_type: string;
    trigger_config: unknown;
    actions: unknown;
  }) {
    const cfg = (r.trigger_config ?? {}) as Record<string, string>;
    setEditandoId(r.id);
    setName(r.name);
    setGrupo(r.group_name ?? "");
    setTemaId(r.tema_id ?? "__all__");
    setTrigger(r.trigger_type as TriggerType);
    setTriggerKanban(cfg.board_key ?? "op");
    setTaskTypeId(cfg.task_type_id ?? "");
    setStageSlug(cfg.to_stage_slug ?? cfg.stage_slug ?? "");
    setActions(
      Array.isArray(r.actions) && r.actions.length
        ? (r.actions as Action[])
        : [{ type: "write_comment", body: "" }],
    );
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Dê um nome ao workflow");
      return;
    }
    const cleanActions = actions
      .map((a) => {
        if (a.type === "write_comment") return { type: a.type, body: (a.body ?? "").trim() };
        if (a.type === "create_task")
          return { type: a.type, title: (a.title ?? "").trim(), due_days: a.due_days ?? null };
        return {
          type: a.type,
          to_stage_slug: (a.to_stage_slug ?? "").trim(),
          // AJ3 — só grava board_key quando NÃO é o principal: regra antiga
          // (sem a chave) e regra nova apontando para o principal ficam idênticas.
          ...(a.board_key && a.board_key !== "op" ? { board_key: a.board_key } : {}),
        };
      })
      .filter((a) =>
        a.type === "write_comment" ? a.body : a.type === "create_task" ? a.title : a.to_stage_slug,
      );
    if (cleanActions.length === 0) {
      toast.error("Adicione ao menos uma ação preenchida");
      return;
    }
    const payload = {
      name: name.trim(),
      groupName: grupo.trim() || null,
      temaId: temaId === "__all__" ? null : temaId,
      triggerType: trigger,
      triggerConfig:
        trigger === "status_changed"
          ? {
              ...(stageSlug.trim() ? { to_stage_slug: stageSlug.trim() } : {}),
              // board_key só quando não é o principal (mantém regras antigas iguais).
              ...(triggerKanban !== "op" ? { board_key: triggerKanban } : {}),
            }
          : trigger === "checklist_completed" && stageSlug.trim()
            ? { stage_slug: stageSlug.trim() }
            : (trigger === "task_created" || trigger === "task_completed") && taskTypeId
              ? { task_type_id: taskTypeId }
              : {},
      actions: cleanActions,
    };

    try {
      if (editandoId) {
        await update.mutateAsync({ id: editandoId, patch: payload });
        toast.success("Workflow atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Workflow criado");
      }
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  return (
    <div className="page-container">
      <Breadcrumb
        items={[{ label: "Configurações", to: "/configuracoes" }, { label: "Workflows" }]}
      />
      <PageHeader
        eyebrow="Automação"
        title="Workflows"
        subtitle="Automações do tipo gatilho → ações (ex.: ao entrar numa etapa, criar tarefa e comentar)."
        aside={
          podeEditar && !open ? (
            <Button onClick={() => setOpen(true)}>
              <Plus size={14} className="mr-1" /> Novo workflow
            </Button>
          ) : undefined
        }
      />

      {open && (
        <div className="card-hero p-6 mb-6 space-y-4">
          <Eyebrow>{editandoId ? "Editar workflow" : "Criar workflow"}</Eyebrow>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Ao entrar em Judicial…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Grupo — só organiza a lista</Label>
              <Input
                value={grupo}
                onChange={(e) => setGrupo(e.target.value)}
                placeholder="Ex.: Follow-up, Onboarding…"
                list="workflow-grupos"
              />
              {/* Sugere os grupos já usados, sem impedir um nome novo. */}
              <datalist id="workflow-grupos">
                {[...new Set((rules ?? []).map((r) => r.group_name).filter(Boolean))].map((g) => (
                  <option key={g as string} value={g as string} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tema</Label>
              <Select
                value={temaId}
                onValueChange={(v) => {
                  setTemaId(v);
                  setTriggerKanban("op"); // kanban depende do tema
                  setStageSlug(""); // etapa depende do tema — evita slug de outro tema
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os temas</SelectItem>
                  {temaList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Gatilho */}
          {(() => {
            const isStageTrigger =
              trigger === "status_changed" || trigger === "checklist_completed";
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Gatilho</Label>
                    <Select value={trigger} onValueChange={(v) => setTrigger(v as TriggerType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            {TRIGGER_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Pedido B (Thiago) — pré-seleção do KANBAN de onde puxar as etapas
                      (Principal / Financeiro / kanbans custom do tema). Só aparece com
                      tema escolhido; em "Todos os temas" a etapa vira texto livre. */}
                  {isStageTrigger && serviceTypeId && (
                    <div className="space-y-1">
                      <Label className="text-xs">Kanban</Label>
                      <Select
                        value={triggerKanban}
                        onValueChange={(v) => {
                          setTriggerKanban(v);
                          setStageSlug(""); // etapa pertence ao kanban
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {kanbanOptions.map((k) => (
                            <SelectItem key={k.key} value={k.key}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Pedido A (Thiago) — sub-opção de TIPO da tarefa. Fonte provisória:
                      catálogo da controladoria. Vazio/"Qualquer tipo" = dispara p/ toda
                      tarefa (só filtra de fato quando a tarefa passar a carregar tipo). */}
                  {/* T1 — classe → tipo (o gatilho enxerga TODOS os tipos, não só
                      os do motor: um workflow pode reagir a tarefa comercial). */}
                  {(trigger === "task_created" || trigger === "task_completed") && (
                    <TaskTypePicker
                      value={taskTypeId || null}
                      onChange={(v) => setTaskTypeId(v ?? "")}
                      emptyLabel="Qualquer tipo"
                      tipoWidth="w-full"
                      classeWidth="w-full"
                    />
                  )}
                </div>
                {isStageTrigger && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {trigger === "status_changed"
                        ? "Quando entrar na etapa — vazio = qualquer"
                        : "Checklist de qual etapa — vazio = qualquer"}
                    </Label>
                    <StageField
                      value={stageSlug}
                      onChange={setStageSlug}
                      options={triggerStageOptions}
                      placeholder="Qualquer etapa"
                    />
                  </div>
                )}
              </>
            );
          })()}

          {/* Ações */}
          <div className="space-y-2">
            <Label className="text-xs">Ações</Label>
            {actions.map((a, i) => (
              <div key={i} className="rounded-md border border-[var(--border)] p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={a.type}
                    onValueChange={(v) =>
                      setActions((prev) =>
                        prev.map((x, idx) => (idx === i ? { type: v as ActionType } : x)),
                      )
                    }
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABELS) as ActionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {ACTION_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {actions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {a.type === "write_comment" && (
                  <Textarea
                    value={a.body ?? ""}
                    onChange={(e) =>
                      setActions((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, body: e.target.value } : x)),
                      )
                    }
                    placeholder="Texto do comentário automático…"
                    rows={2}
                  />
                )}
                {a.type === "create_task" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={a.title ?? ""}
                      onChange={(e) =>
                        setActions((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)),
                        )
                      }
                      placeholder="Título da tarefa"
                    />
                    <Input
                      type="number"
                      value={a.due_days ?? ""}
                      onChange={(e) =>
                        setActions((prev) =>
                          prev.map((x, idx) =>
                            idx === i
                              ? {
                                  ...x,
                                  due_days: e.target.value ? Number(e.target.value) : undefined,
                                }
                              : x,
                          ),
                        )
                      }
                      placeholder="Prazo (dias a partir de hoje)"
                    />
                  </div>
                )}
                {a.type === "move_stage" && (
                  <MoveStageActionFields
                    boardKey={a.board_key ?? "op"}
                    stageSlug={a.to_stage_slug ?? ""}
                    onChange={(patch) =>
                      setActions((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
                      )
                    }
                    kanbanOptions={kanbanOptions}
                    opStages={opStages as never}
                    finStages={finStages as never}
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setActions((prev) => [...prev, { type: "write_comment", body: "" }])}
              className="text-[12px] text-[var(--gold-700)] hover:underline inline-flex items-center gap-1"
            >
              <Plus size={13} /> Adicionar ação
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={create.isPending}>
              {create.isPending ? "Salvando…" : "Criar workflow"}
            </Button>
          </div>
        </div>
      )}

      {/* W1 - filtros. Thiago: "quando todos os temas forem vindos, isso aqui vai
          ficar um negocio que ninguem acha mais nada." */}
      {!isLoading && (rules ?? []).length > 0 && (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              className="w-[220px]"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou código (WF-0007)"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tema</Label>
            <Select value={filtroTema} onValueChange={setFiltroTema}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os temas</SelectItem>
                {temaList.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select
              value={filtroEstado}
              onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="suspensos">Suspensos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground pb-2">
            {listaFiltrada.length} de {(rules ?? []).length}
          </span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (rules ?? []).length === 0 ? (
        <div className="card-editorial p-8 text-center text-muted-foreground text-sm">
          <Zap size={20} className="mx-auto mb-2 text-[var(--gold-700)]" />
          Nenhum workflow ainda. Crie o primeiro para automatizar ações do caso.
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div className="card-editorial p-8 text-center text-muted-foreground text-sm">
          Nenhum workflow neste filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {listaFiltrada.map((r, i) => (
            <Fragment key={r.id}>
              {/* Cabecalho do GRUPO - so visual, como o Thiago pediu. */}
              {(i === 0 || (listaFiltrada[i - 1].group_name ?? "") !== (r.group_name ?? "")) && (
                <div className="flex items-baseline gap-2 pt-3 first:pt-0">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--navy)]">
                    {r.group_name || "Sem grupo"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {
                      listaFiltrada.filter((x) => (x.group_name ?? "") === (r.group_name ?? ""))
                        .length
                    }
                  </span>
                </div>
              )}
              <div className="card-editorial p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.code && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                        title="Identificador do workflow - aparece nas acoes que ele gera"
                      >
                        {r.code}
                      </Badge>
                    )}
                    <span className="font-medium text-[var(--navy)]">{r.name}</span>
                    <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">
                      {r.active ? "Ativo" : "Suspenso"}
                    </Badge>
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {TRIGGER_LABELS[r.trigger_type as TriggerType] ?? r.trigger_type}
                    {" · "}
                    {Array.isArray(r.actions) ? r.actions.length : 0} ação(ões)
                    {r.tema_id ? "" : " · todos os temas"}
                  </div>
                </div>
                {podeEditar && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => editar(r)}>
                      <Pencil size={14} className="mr-1" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        update.mutate(
                          { id: r.id, patch: { active: !r.active } },
                          { onError: (e) => toast.error(e instanceof Error ? e.message : "Erro") },
                        )
                      }
                    >
                      {/* "Desativar" virou "Suspender" (Thiago: "porque as pessoas
                          vao ter duvidas") - suspender deixa claro que da para voltar. */}
                      {r.active ? "Suspender" : "Reativar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir o workflow "${r.name}"?`)) del.mutate(r.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
