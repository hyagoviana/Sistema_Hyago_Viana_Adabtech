import { CalendarDays, Check, Plus, Trash2, User } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/hv/primitives";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCaseTasks,
  useCreateCaseTask,
  useSetCaseTaskStatus,
  useDeleteCaseTask,
} from "@/hooks/useDossie";
import { useAssignableUsers } from "@/hooks/useUsers";
import { useTaskTypesCatalog } from "@/hooks/useTaskTypes";
import { isTaskConcluida, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/task-status-shared";

const PRIORITY_TONE: Record<string, "neutral" | "navy" | "warning" | "danger"> = {
  BAIXA: "neutral",
  MEDIA: "navy",
  ALTA: "warning",
  URGENTE: "danger",
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[22px] font-semibold text-[var(--navy)] mb-3">{children}</h2>
  );
}

// ---------------------------------------------------------------- Tarefas ----
// O "tipo" da tarefa era uma lista fixa no código, que só prefixava o título com
// [Judicial]. Doc "21.08 _ Controladoria": o tipo passa a vir do CATÁLOGO ÚNICO
// do sistema (Configurações > Tipos de tarefa), gravado em task_type_id — o que
// também alimenta o filtro por tipo nos gatilhos de workflow e a pontuação do
// motor de distribuição.
const SEM_TIPO = "__sem_tipo__";

function TasksSection({ caseId, canEdit }: { caseId: string; canEdit: boolean }) {
  const { data: tasks, isLoading } = useCaseTasks(caseId);
  const { data: users } = useAssignableUsers();
  const create = useCreateCaseTask(caseId);
  const setStatus = useSetCaseTaskStatus(caseId);
  const del = useDeleteCaseTask(caseId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [assigneeId, setAssigneeId] = useState<string>("__none__");
  const [dueDate, setDueDate] = useState("");
  const [taskTypeId, setTaskTypeId] = useState(SEM_TIPO);
  const { data: taskTypes } = useTaskTypesCatalog({ estado: "ativos" });

  const activeUsers = (users ?? []).filter((u: { status: string }) => u.status === "ACTIVE");

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("MEDIA");
    setAssigneeId("__none__");
    setDueDate("");
    setTaskTypeId(SEM_TIPO);
  }

  async function add() {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        case_id: caseId,
        title: title.trim(),
        priority,
        assignee_id: assigneeId !== "__none__" ? assigneeId : null,
        due_date: dueDate || null,
        task_type_id: taskTypeId !== SEM_TIPO ? taskTypeId : null,
      });
      resetForm();
      setDialogOpen(false);
      toast.success("Tarefa criada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
    }
  }

  const nomeDoTipo = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of taskTypes ?? []) m.set(t.id, t.nome);
    return m;
  }, [taskTypes]);

  function daysUntilDue(d: string | null) {
    if (!d) return null;
    const diff = Math.ceil(
      (new Date(d + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Tarefas</SectionTitle>
        {canEdit && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus size={14} className="mr-1" /> Nova tarefa
          </Button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
            <DialogDescription>Preencha os detalhes da tarefa para este caso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={taskTypeId} onValueChange={setTaskTypeId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_TIPO}>Sem tipo</SelectItem>
                    {(taskTypes ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["BAIXA", "MEDIA", "ALTA", "URGENTE"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                className="mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Enviar documento para o cliente"
                autoFocus
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                className="mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais sobre a tarefa…"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem responsável</SelectItem>
                    {activeUsers.map(
                      (u: { id: string; full_name: string | null; email: string }) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de vencimento</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={add} disabled={create.isPending || !title.trim()}>
              {create.isPending ? "Criando…" : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="card-editorial p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !tasks || tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa ainda.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {tasks.map((t) => {
              const done = isTaskConcluida(t.status);
              const daysLeft = daysUntilDue(t.due_date);
              const overdue = daysLeft !== null && daysLeft < 0 && !done;
              const soon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && !done;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <button
                    title={done ? "Reabrir" : "Concluir"}
                    onClick={() =>
                      setStatus.mutate({
                        id: t.id,
                        // Clique rápido = o caminho de 90%: concluir com sucesso.
                        // Os outros desfechos ficam no seletor ao lado.
                        status: done ? "EM_ANDAMENTO" : "CONCLUIDA_SUCESSO",
                      })
                    }
                    className="shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors"
                    style={{
                      borderColor: done ? "var(--success)" : "var(--border)",
                      background: done ? "var(--success)" : "transparent",
                    }}
                  >
                    {done && <Check size={13} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[14px] text-[var(--navy)] ${done ? "line-through opacity-50" : ""}`}
                    >
                      {t.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground mt-0.5 flex-wrap">
                      {t.assignee_name && (
                        <span className="inline-flex items-center gap-1">
                          <User size={10} /> {t.assignee_name}
                        </span>
                      )}
                      {t.due_date && (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{
                            color: overdue ? "var(--danger)" : soon ? "var(--warning)" : undefined,
                            fontWeight: overdue || soon ? 600 : undefined,
                          }}
                        >
                          <CalendarDays size={10} />
                          {fmtDate(t.due_date)}
                          {overdue && ` (${Math.abs(daysLeft!)}d atraso)`}
                          {soon && daysLeft === 0 && " (hoje)"}
                          {soon && daysLeft! > 0 && ` (${daysLeft}d)`}
                        </span>
                      )}
                    </div>
                  </div>
                  {t.task_type_id && nomeDoTipo.get(t.task_type_id) && (
                    <Badge tone="neutral">{nomeDoTipo.get(t.task_type_id)}</Badge>
                  )}
                  <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"}>
                    {t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}
                  </Badge>
                  {/* TK1 — os 4 desfechos do ProJuris. O checkbox continua para o
                      caso comum; aqui é onde se registra "sem sucesso"/"cancelada". */}
                  <Select
                    value={(TASK_STATUSES as readonly string[]).includes(t.status) ? t.status : ""}
                    onValueChange={(v) => setStatus.mutate({ id: t.id, status: v })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-7 w-[190px] text-[12px] shrink-0">
                      <SelectValue placeholder={t.status} />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((st) => (
                        <SelectItem key={st} value={st} className="text-[12px]">
                          {TASK_STATUS_LABEL[st]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => del.mutate(t.id)}
                    title="Excluir"
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// #15 (2026-08-17) — CaseDossie = só TAREFAS. O prazo agora é o da própria tarefa
// (due_date); a seção de "Prazos" isolados e a de "Comunicações" foram removidas
// da UI (os dados legados em system_case_deadlines / system_case_communications
// permanecem no banco, apenas não são mais exibidos/editados aqui).
export function CaseDossie({ caseId, canEdit = true }: { caseId: string; canEdit?: boolean }) {
  return (
    <div className="space-y-8">
      <TasksSection caseId={caseId} canEdit={canEdit} />
    </div>
  );
}
