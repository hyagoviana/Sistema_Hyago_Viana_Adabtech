// S4-04 — Timeline de atividades do caso (read-only para eventos automáticos).
//   - Lista system_case_events por case_id, em created_at DESC.
//   - Entrada MANUAL (marco/nota) auth-only, gravada como evento próprio.
//   - Eventos AUTOMÁTICOS são read-only reais (sem botão de editar/apagar); o
//     bloqueio de verdade é no servidor (cases-service.loadEditableManualEvent).

import { Flag, Pencil, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCaseEvents } from "@/hooks/useCases";
import {
  useAddManualCaseEvent,
  useDeleteManualCaseEvent,
  useUpdateManualCaseEvent,
} from "@/hooks/useTimeline";

const MANUAL_ACTIONS = new Set(["nota_manual", "marco"]);

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type CaseEvent = {
  id: string;
  action: string;
  from_macrostatus_op: string | null;
  to_macrostatus_op: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
  triggered_by_name?: string | null;
};

// É manual (editável) somente se a action for de entrada manual E diff.manual = true.
function isManualEvent(e: CaseEvent): boolean {
  return MANUAL_ACTIONS.has(e.action) && !!(e.diff as { manual?: boolean } | null)?.manual;
}

function renderEventLabel(e: CaseEvent): string {
  const d = (e.diff as Record<string, string> | null) ?? null;
  switch (e.action) {
    case "created":
      return "Caso criado";
    case "created_comercial":
      return "Caso criado (comercial — aguardando assinatura da procuração)";
    case "status_changed":
      return `Status mudou: ${e.from_macrostatus_op ?? "—"} → ${e.to_macrostatus_op ?? "—"}`;
    case "fin_status_changed":
      return `Status financeiro mudou: ${d?.from ?? "—"} → ${d?.to ?? "—"}`;
    case "fin_stage_auto_advanced":
      return `Avanço automático (financeiro) por checklist: ${d?.from ?? "—"} → ${d?.to ?? "—"}`;
    case "fin_enviado_conferencia":
      return `Enviado para conferência (financeiro): ${d?.from ?? "—"} → ${d?.to ?? "—"}`;
    case "fin_conferencia_aprovada":
      return "Conferência financeira aprovada (segunda pessoa)";
    case "updated":
      return "Caso editado";
    case "soft_deleted":
      return "Caso excluído";
    case "stage_auto_advanced":
      return `Avanço automático por checklist: ${d?.from ?? "—"} → ${d?.to ?? "—"}`;
    case "checklist_inconsistente":
      return `Checklist inconsistente: item obrigatório "${d?.def_key ?? "—"}" da etapa ${d?.stage_slug ?? "—"} foi desmarcado após avanço`;
    case "canonical_fields_updated":
      return "Dados do serviço atualizados";
    case "task_created":
      return `Tarefa criada: ${d?.task_title ?? "—"}`;
    case "task_started":
      return `Tarefa iniciada: ${d?.task_title ?? "—"}`;
    case "task_completed":
      return `Tarefa concluída: ${d?.task_title ?? "—"}`;
    case "task_status_changed":
      return `Tarefa "${d?.task_title ?? "—"}" → ${d?.status ?? "—"}`;
    case "task_deleted":
      return `Tarefa excluída: ${d?.task_title ?? "—"}`;
    case "doc_generated":
      return `Documento gerado: ${d?.doc_title ?? "—"}`;
    case "doc_finalized":
      return `Documento finalizado: ${d?.doc_title ?? "—"}`;
    case "doc_reopened":
      return `Documento reaberto: ${d?.doc_title ?? "—"}`;
    case "doc_sent_zapsign":
      return `Documento enviado para assinatura: ${d?.doc_title ?? "—"}`;
    case "doc_deleted":
      return `Documento excluído: ${d?.doc_title ?? "—"}`;
    case "procuracao_preparada":
      return "Procuração preparada";
    case "liberado_comercial":
      return d?.via === "manual"
        ? "Promovido para cliente (manual)"
        : `Procuração assinada — caso liberado para operação${d?.via ? ` (${d.via})` : ""}`;
    case "perdido":
      return `Caso marcado como perdido${d?.motivo ? ` — ${d.motivo}` : ""}`;
    case "deadline_created":
      return `Prazo criado: ${d?.deadline_title ?? "—"} (${d?.fatal_date ?? "—"})`;
    case "deadline_completed":
      return `Prazo cumprido: ${d?.deadline_title ?? "—"}`;
    case "deadline_missed":
      return `Prazo perdido: ${d?.deadline_title ?? "—"}`;
    case "deadline_status_changed":
      return `Prazo "${d?.deadline_title ?? "—"}" → ${d?.status ?? "—"}`;
    case "deadline_deleted":
      return `Prazo excluído: ${d?.deadline_title ?? "—"}`;
    case "communication_logged":
      return `Comunicação registrada (${d?.channel ?? "—"}): ${d?.summary ?? "—"}`;
    case "communication_deleted":
      return `Comunicação excluída: ${d?.summary ?? "—"}`;
    // Manuais (S4-04)
    case "marco":
      return d?.body ?? "Marco";
    case "nota_manual":
      return d?.body ?? "Nota";
    default:
      return e.action;
  }
}

export function CaseTimeline({ caseId }: { caseId: string }) {
  const { data: events } = useCaseEvents(caseId);
  const add = useAddManualCaseEvent(caseId);
  const update = useUpdateManualCaseEvent(caseId);
  const remove = useDeleteManualCaseEvent(caseId);

  const [action, setAction] = useState<"marco" | "nota_manual">("marco");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const list = (events ?? []) as CaseEvent[];

  async function handleAdd() {
    const body = draft.trim();
    if (!body) {
      toast.error("Escreva o texto do marco/nota");
      return;
    }
    try {
      await add.mutateAsync({ action, body });
      setDraft("");
      toast.success("Registrado na timeline");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao registrar");
    }
  }

  async function handleUpdate(eventId: string) {
    const body = editBody.trim();
    if (!body) {
      toast.error("Escreva o texto");
      return;
    }
    try {
      await update.mutateAsync({ eventId, body });
      setEditingId(null);
      setEditBody("");
      toast.success("Atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao editar");
    }
  }

  async function handleDelete(eventId: string) {
    try {
      await remove.mutateAsync(eventId);
      setConfirmDelete(null);
      toast.success("Removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  return (
    <div>
      <h2 className="font-display text-[24px] font-semibold text-[var(--navy)] mb-3">
        Linha do tempo
      </h2>

      {/* Entrada manual (auth-only) */}
      <div className="card-editorial p-4 mb-4">
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setAction("marco")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              action === "marco"
                ? "bg-[var(--navy)] text-white"
                : "text-muted-foreground hover:bg-[var(--ink-50)]"
            }`}
          >
            <Flag size={13} /> Marco
          </button>
          <button
            type="button"
            onClick={() => setAction("nota_manual")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              action === "nota_manual"
                ? "bg-[var(--navy)] text-white"
                : "text-muted-foreground hover:bg-[var(--ink-50)]"
            }`}
          >
            <StickyNote size={13} /> Nota
          </button>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Adicione um marco ou nota manual à timeline deste caso…"
          rows={2}
          className="resize-y"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={add.isPending || !draft.trim()}>
            {add.isPending ? "Registrando…" : "Adicionar à timeline"}
          </Button>
        </div>
      </div>

      <div className="card-editorial !p-0 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic text-sm">
            Sem eventos registrados.
          </div>
        ) : (
          <ul>
            {list.map((e) => {
              const manual = isManualEvent(e);
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 px-5 py-3 border-b border-[var(--border)] last:border-0"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                      manual ? "bg-[var(--navy)]" : "bg-[var(--gold)]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    {editingId === e.id ? (
                      <div>
                        <Textarea
                          value={editBody}
                          onChange={(ev) => setEditBody(ev.target.value)}
                          rows={2}
                          className="resize-y"
                          autoFocus
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditBody("");
                            }}
                            disabled={update.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdate(e.id)}
                            disabled={update.isPending || !editBody.trim()}
                          >
                            {update.isPending ? "Salvando…" : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-[var(--navy)] font-medium whitespace-pre-wrap break-words">
                            {manual && (
                              <span className="text-[10px] uppercase tracking-wider text-[var(--gold-700)] mr-1.5">
                                {e.action === "marco" ? "Marco" : "Nota"}
                              </span>
                            )}
                            {renderEventLabel(e)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {fmtDateTime(e.created_at)}
                            {e.triggered_by_name && (
                              <span className="ml-2">
                                por <strong>{e.triggered_by_name}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Editar/apagar SÓ em eventos manuais. Automáticos = read-only. */}
                        {manual && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Editar"
                              onClick={() => {
                                setEditingId(e.id);
                                setEditBody((e.diff as { body?: string } | null)?.body ?? "");
                              }}
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Excluir"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setConfirmDelete(e.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este item da timeline?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas marcos/notas manuais podem ser removidos. Eventos automáticos do sistema são
              somente-leitura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={remove.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
