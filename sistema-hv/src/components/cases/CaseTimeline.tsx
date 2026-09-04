// S4-04 — Timeline de atividades do caso (read-only para eventos automáticos).
//   - Lista system_case_events por case_id, em created_at DESC.
//   - Entrada MANUAL (marco/nota) auth-only, gravada como evento próprio.
//   - Eventos AUTOMÁTICOS são read-only reais (sem botão de editar/apagar); o
//     bloqueio de verdade é no servidor (cases-service.loadEditableManualEvent).

import { Pencil, Trash2 } from "lucide-react";
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
import { useCase, useCaseEvents } from "@/hooks/useCases";
import { useAllStageLabels, useStages } from "@/hooks/usePipeline";
import { MACRO_FIN_LABELS, MACRO_OP_LABELS } from "@/lib/cases/constants";
import { makeStageLabelResolver } from "@/lib/cases/stage-label";
import { isManualEvent, renderEventLabel } from "./case-event-label";
import { useDeleteManualCaseEvent, useUpdateManualCaseEvent } from "@/hooks/useTimeline";

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

export function CaseTimeline({ caseId }: { caseId: string }) {
  const { data: events } = useCaseEvents(caseId);
  // L1 — as etapas do caso viram o de-para slug → rótulo. Enquanto carregam, o
  // resolvedor cai no formatador de slug (nunca renderiza vazio).
  const { data: caso } = useCase(caseId);
  const serviceTypeId = (caso as { service_type_id?: string } | undefined)?.service_type_id ?? "";
  const { data: stagesOp } = useStages(serviceTypeId, "op");
  const { data: stagesFin } = useStages(serviceTypeId, "fin");
  // BUG 1a (04/09) — inclui as etapas dos kanbans CUSTOM; sem elas o slug com
  // sufixo técnico ("3 dias follow up mt7bl3x2nssp") vazava para a tela. Mesma
  // correção do CaseFeed — os dois leem o mesmo `case-event-label`.
  const { data: stageLabels } = useAllStageLabels(serviceTypeId);
  const resolveEtapa = makeStageLabelResolver(
    [stagesOp, stagesFin, stageLabels],
    MACRO_OP_LABELS,
    MACRO_FIN_LABELS,
  );
  const update = useUpdateManualCaseEvent(caseId);
  const remove = useDeleteManualCaseEvent(caseId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // F1 (AC-5) — a ficha comum NÃO mistura eventos financeiros: filtra na CAMADA
  // DE APRESENTAÇÃO toda `action` que começa com `fin_` (fin_status_changed,
  // fin_stage_auto_advanced, fin_enviado_conferencia, fin_conferencia_aprovada e
  // variações futuras). Os eventos continuam gravados no banco; só não são
  // MOSTRADOS aqui (aparecem no submenu financeiro, para quem tem acesso).
  // AU1 (2026-08-26) — alteração de CAMPO do caso sai da linha do tempo e passa a
  // viver no menu Auditoria. Thiago: "essa mudança de dado do serviço, campo
  // atualizado, eu acho que não precisa vir para cá". O evento continua GRAVADO
  // (é a trilha de auditoria) — só não é mostrado aqui.
  const list = ((events ?? []) as CaseEvent[]).filter(
    (e) => !e.action.startsWith("fin_") && e.action !== "canonical_fields_updated",
  );

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

      {/* A6 (2026-08-03) — a linha do tempo é AUTOMÁTICA: registra criação/edição
          do caso, mudança de etapa, documentos, assinatura, notas, tarefas, prazos
          e comunicações. A escrita manual foi removida (anotações vão no bloco Notas). */}
      <div className="card-editorial !p-0 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
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
                            {renderEventLabel(e, resolveEtapa)}
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
