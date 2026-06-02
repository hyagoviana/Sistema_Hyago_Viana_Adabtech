import { Check, Clock, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
function TasksSection({ caseId }: { caseId: string }) {
  const { data: tasks, isLoading } = useCaseTasks(caseId);
  const create = useCreateCaseTask(caseId);
  const setStatus = useSetCaseTaskStatus(caseId);
  const del = useDeleteCaseTask(caseId);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIA");

  async function add() {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({ case_id: caseId, title: title.trim(), priority });
      setTitle("");
      setPriority("MEDIA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
    }
  }

  return (
    <section>
      <SectionTitle>Tarefas</SectionTitle>
      <div className="card-editorial p-4">
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Nova tarefa…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-[130px] shrink-0">
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
          <Button onClick={add} disabled={create.isPending || !title.trim()} className="shrink-0">
            <Plus size={15} className="mr-1" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !tasks || tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhuma tarefa ainda.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {tasks.map((t) => {
              const done = t.status === "CONCLUIDA";
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
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
                      className={`text-[14px] text-[var(--navy)] truncate ${done ? "line-through opacity-50" : ""}`}
                    >
                      {t.title}
                    </div>
                    {t.due_date && (
                      <div className="text-[11.5px] text-muted-foreground">
                        Vence {fmtDate(t.due_date)}
                      </div>
                    )}
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
  const create = useCreateCaseDeadline(caseId);
  const setStatus = useSetCaseDeadlineStatus(caseId);
  const del = useDeleteCaseDeadline(caseId);
  const [title, setTitle] = useState("");
  const [fatal, setFatal] = useState("");

  async function add() {
    if (!title.trim() || !fatal) return;
    try {
      await create.mutateAsync({ case_id: caseId, title: title.trim(), fatal_date: fatal });
      setTitle("");
      setFatal("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar prazo");
    }
  }

  return (
    <section>
      <SectionTitle>Prazos</SectionTitle>
      <div className="card-editorial p-4">
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Descrição do prazo…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            type="date"
            value={fatal}
            onChange={(e) => setFatal(e.target.value)}
            className="w-[160px] shrink-0"
          />
          <Button
            onClick={add}
            disabled={create.isPending || !title.trim() || !fatal}
            className="shrink-0"
          >
            <Plus size={15} className="mr-1" /> Adicionar
          </Button>
        </div>

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
                    <div className="text-[11.5px] text-muted-foreground">
                      Data fatal: {fmtDate(d.fatal_date)}
                      {overdue && <span className="text-[var(--danger)] font-medium"> · vencido</span>}
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
