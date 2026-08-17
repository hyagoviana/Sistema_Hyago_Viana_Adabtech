// #2 (2026-08-17) — Workflows / automações (FUNDAÇÃO). Builder "Criar workflow":
// Gatilho → Ações. v1: gatilho status_changed cabeado (dispara ao mover etapa);
// checklist_completed / task_created / task_completed já aceitos pelo schema e
// serão cabeados nos respectivos eventos em seguida.
//
// Gate: sistema (view p/ ver; edit p/ criar/editar/excluir) — herda dos RPCs.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
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
import { usePodeEditar } from "@/hooks/usePermissions";

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

function WorkflowsPage() {
  const podeEditar = usePodeEditar("sistema");
  const { data: rules, isLoading } = useWorkflowRules();
  const { data: temas } = useTemas();
  const create = useCreateWorkflowRule();
  const update = useUpdateWorkflowRule();
  const del = useDeleteWorkflowRule();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [temaId, setTemaId] = useState<string>("__all__");
  const [trigger, setTrigger] = useState<TriggerType>("status_changed");
  const [stageSlug, setStageSlug] = useState("");
  const [actions, setActions] = useState<Action[]>([{ type: "write_comment", body: "" }]);

  const temaList = (temas as Array<{ id: string; name: string }> | undefined) ?? [];

  function reset() {
    setName("");
    setTemaId("__all__");
    setTrigger("status_changed");
    setStageSlug("");
    setActions([{ type: "write_comment", body: "" }]);
    setOpen(false);
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
        return { type: a.type, to_stage_slug: (a.to_stage_slug ?? "").trim() };
      })
      .filter((a) =>
        a.type === "write_comment" ? a.body : a.type === "create_task" ? a.title : a.to_stage_slug,
      );
    if (cleanActions.length === 0) {
      toast.error("Adicione ao menos uma ação preenchida");
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        temaId: temaId === "__all__" ? null : temaId,
        triggerType: trigger,
        triggerConfig:
          trigger === "status_changed" && stageSlug.trim()
            ? { to_stage_slug: stageSlug.trim() }
            : {},
        actions: cleanActions,
      });
      toast.success("Workflow criado");
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
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
          <Eyebrow>Criar workflow</Eyebrow>
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
              <Label className="text-xs">Tema</Label>
              <Select value={temaId} onValueChange={setTemaId}>
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
                      {t !== "status_changed" ? " (em breve)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {trigger === "status_changed" && (
              <div className="space-y-1">
                <Label className="text-xs">Quando entrar na etapa (slug) — vazio = qualquer</Label>
                <Input
                  value={stageSlug}
                  onChange={(e) => setStageSlug(e.target.value)}
                  placeholder="EM_ANDAMENTO"
                />
              </div>
            )}
          </div>

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
                  <Input
                    value={a.to_stage_slug ?? ""}
                    onChange={(e) =>
                      setActions((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, to_stage_slug: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Slug da etapa destino"
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

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (rules ?? []).length === 0 ? (
        <div className="card-editorial p-8 text-center text-muted-foreground text-sm">
          <Zap size={20} className="mx-auto mb-2 text-[var(--gold-700)]" />
          Nenhum workflow ainda. Crie o primeiro para automatizar ações do caso.
        </div>
      ) : (
        <div className="space-y-2">
          {(rules ?? []).map((r) => (
            <div key={r.id} className="card-editorial p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--navy)]">{r.name}</span>
                  <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">
                    {r.active ? "Ativo" : "Inativo"}
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
                    {r.active ? "Desativar" : "Ativar"}
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
          ))}
        </div>
      )}
    </div>
  );
}
