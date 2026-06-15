import { CalendarDays, Check, Clock, MessageSquare, Plus, Trash2, User } from "lucide-react";
import { useState } from "react";
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
  useCaseDeadlines,
  useCreateCaseDeadline,
  useSetCaseDeadlineStatus,
  useDeleteCaseDeadline,
  useCaseCommunications,
  useCreateCaseCommunication,
  useDeleteCaseCommunication,
} from "@/hooks/useDossie";
import { useUsers } from "@/hooks/useUsers";

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
const TASK_TYPES = [
  { value: "GERAL", label: "Geral" },
  { value: "DOCUMENTO", label: "Documento" },
  { value: "CONTATO_CLIENTE", label: "Contato com cliente" },
  { value: "PROTOCOLO", label: "Protocolo" },
  { value: "AUDIENCIA", label: "Audiência" },
  { value: "ANALISE", label: "Análise" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "JUDICIAL", label: "Judicial" },
];

function TasksSection({ caseId }: { caseId: string }) {
  const { data: tasks, isLoading } = useCaseTasks(caseId);
  const { data: users } = useUsers();
  const create = useCreateCaseTask(caseId);
  const setStatus = useSetCaseTaskStatus(caseId);
  const del = useDeleteCaseTask(caseId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [assigneeId, setAssigneeId] = useState<string>("__none__");
  const [dueDate, setDueDate] = useState("");
  const [taskType, setTaskType] = useState("GERAL");

  const activeUsers = (users ?? []).filter(
    (u: { status: string }) => u.status === "ACTIVE",
  );

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("MEDIA");
    setAssigneeId("__none__");
    setDueDate("");
    setTaskType("GERAL");
  }

  async function add() {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        case_id: caseId,
        title: `[${TASK_TYPES.find((t) => t.value === taskType)?.label ?? taskType}] ${title.trim()}`,
        priority,
        assignee_id: assigneeId !== "__none__" ? assigneeId : null,
        due_date: dueDate || null,
      });
      resetForm();
      setDialogOpen(false);
      toast.success("Tarefa criada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
    }
  }

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
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1" /> Nova tarefa
        </Button>
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
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
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
          <p className="text-sm text-muted-foreground italic">Nenhuma tarefa ainda.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {tasks.map((t) => {
              const done = t.status === "CONCLUIDA";
              const daysLeft = daysUntilDue(t.due_date);
              const overdue = daysLeft !== null && daysLeft < 0 && !done;
              const soon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && !done;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <button
                    title={done ? "Reabrir" : "Concluir"}
                    onClick={() =>
                      setStatus.mutate({ id: t.id, status: done ? "PENDENTE" : "CONCLUIDA" })
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
                            color: overdue
                              ? "var(--danger)"
                              : soon
                                ? "var(--warning)"
                                : undefined,
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
                  <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"}>
                    {t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}
                  </Badge>
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

// ----------------------------------------------------------------- Prazos ----
function DeadlinesSection({ caseId }: { caseId: string }) {
  const { data: deadlines, isLoading } = useCaseDeadlines(caseId);
  const { data: users } = useUsers();
  const create = useCreateCaseDeadline(caseId);
  const setStatus = useSetCaseDeadlineStatus(caseId);
  const del = useDeleteCaseDeadline(caseId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [fatal, setFatal] = useState("");
  const [responsible, setResponsible] = useState<string>("__none__");

  const activeUsers = (users ?? []).filter(
    (u: { status: string }) => u.status === "ACTIVE",
  );
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name ?? u.email]));

  function resetForm() {
    setTitle("");
    setFatal("");
    setResponsible("__none__");
  }

  async function add() {
    if (!title.trim() || !fatal) return;
    try {
      await create.mutateAsync({
        case_id: caseId,
        title: title.trim(),
        fatal_date: fatal,
        responsible: responsible !== "__none__" ? responsible : null,
      });
      resetForm();
      setDialogOpen(false);
      toast.success("Prazo criado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar prazo");
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Prazos</SectionTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1" /> Novo prazo
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo prazo</DialogTitle>
            <DialogDescription>Preencha os detalhes do prazo para este caso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input
                className="mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Prazo para contestação"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data fatal</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={fatal}
                  onChange={(e) => setFatal(e.target.value)}
                />
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={responsible} onValueChange={setResponsible}>
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
            <Button onClick={add} disabled={create.isPending || !title.trim() || !fatal}>
              {create.isPending ? "Criando…" : "Criar prazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="card-editorial p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !deadlines || deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhum prazo cadastrado.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {deadlines.map((d) => {
              const fulfilled = d.status === "CUMPRIDO";
              const overdue =
                !fulfilled && d.status !== "PERDIDO" && new Date(d.fatal_date) < new Date();
              const ownerName = d.responsible ? userMap.get(d.responsible) : null;
              return (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <Clock
                    size={16}
                    className="shrink-0"
                    style={{
                      color: fulfilled
                        ? "var(--success)"
                        : overdue
                          ? "var(--danger)"
                          : "var(--gold-700)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[14px] text-[var(--navy)] truncate ${fulfilled ? "opacity-50" : ""}`}>
                      {d.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground mt-0.5 flex-wrap">
                      <span>
                        Data fatal: {fmtDate(d.fatal_date)}
                        {overdue && <span className="text-[var(--danger)] font-medium"> · vencido</span>}
                      </span>
                      {ownerName && (
                        <span className="inline-flex items-center gap-1">
                          <User size={10} /> {ownerName}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge tone={fulfilled ? "success" : overdue ? "danger" : "gold"}>
                    {fulfilled ? "Cumprido" : d.status === "PERDIDO" ? "Perdido" : "Aberto"}
                  </Badge>
                  {!fulfilled && (
                    <button
                      onClick={() => setStatus.mutate({ id: d.id, status: "CUMPRIDO" })}
                      title="Marcar cumprido"
                      className="shrink-0 text-muted-foreground hover:text-[var(--success)] transition-colors"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => del.mutate(d.id)}
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

// ------------------------------------------------------------ Comunicações ----
const CHANNELS = ["WHATSAPP", "EMAIL", "TELEFONE", "PRESENCIAL", "PORTAL", "OUTRO"];

function CommsSection({ caseId }: { caseId: string }) {
  const { data: comms, isLoading } = useCaseCommunications(caseId);
  const create = useCreateCaseCommunication(caseId);
  const del = useDeleteCaseCommunication(caseId);
  const [summary, setSummary] = useState("");
  const [channel, setChannel] = useState("WHATSAPP");

  async function add() {
    if (!summary.trim()) return;
    try {
      await create.mutateAsync({ case_id: caseId, summary: summary.trim(), channel });
      setSummary("");
      toast.success("Comunicação registrada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar comunicação");
    }
  }

  return (
    <section>
      <SectionTitle>Comunicações</SectionTitle>
      <div className="card-editorial p-4">
        <div className="flex gap-2 mb-4">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Resumo da conversa…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={create.isPending || !summary.trim()} className="shrink-0">
            <Plus size={15} className="mr-1" /> Registrar
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !comms || comms.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhuma comunicação registrada.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {comms.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-2.5">
                <MessageSquare size={16} className="shrink-0 mt-0.5 text-[var(--gold-700)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[var(--navy)]">{c.summary}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {c.channel.charAt(0) + c.channel.slice(1).toLowerCase()} ·{" "}
                    {new Date(c.occurred_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <button
                  onClick={() => del.mutate(c.id)}
                  title="Excluir"
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function CaseDossie({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-8">
      <TasksSection caseId={caseId} />
      <DeadlinesSection caseId={caseId} />
      <CommsSection caseId={caseId} />
    </div>
  );
}
