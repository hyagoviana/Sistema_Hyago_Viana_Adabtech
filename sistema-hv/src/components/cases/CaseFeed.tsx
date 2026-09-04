// M1 (2026-08-07) — Feed UNIFICADO "Notas / Linha do tempo" (estilo Trello).
//   - Mescla, em memória, os eventos automáticos/manuais (system_case_events) e
//     os comentários da ficha comum (system_case_notes scope='geral') num ÚNICO
//     array cronológico, renderizado como CARDS.
//   - Caixa de comentário no topo (useCreateCaseNote → scope 'geral').
//   - Isolamento financeiro (F1): filtra eventos `fin_*`; o feed só lê as notas
//     'geral' (nunca as 'financeiro' do submenu).
//   - Sem duplicação nota × evento `note_added` (D-M1a): o evento `note_added` é
//     filtrado do feed; o comentário aparece pela fonte system_case_notes (que
//     tem body/autor/editar/excluir). O `note_added` continua gravado (auditoria).
//   - Regra Trello (imposta TAMBÉM no servidor): o AUTOR edita/exclui o próprio
//     comentário; um ADMIN pode EXCLUIR de qualquer um (mas não editar alheio).
//     Eventos automáticos = read-only; marcos/notas manuais seguem o padrão atual.
//   - Container com barra de rolagem quando passa da altura-limite.

import { useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCaseNotes,
  useCreateCaseNote,
  useSoftDeleteNote,
  useUpdateNote,
} from "@/hooks/useNotes";
import { useCase, useCaseEvents } from "@/hooks/useCases";
import { useAllStageLabels, useStages } from "@/hooks/usePipeline";
import { MACRO_FIN_LABELS, MACRO_OP_LABELS } from "@/lib/cases/constants";
import { makeStageLabelResolver } from "@/lib/cases/stage-label";
import { isManualEvent, renderEventLabel } from "./case-event-label";
import { useDeleteManualCaseEvent, useUpdateManualCaseEvent } from "@/hooks/useTimeline";
import { useAuth } from "@/lib/auth";

// Cartão de alto relevo de cada item da linha do tempo (estilo Trello elevado).
// Sombra em duas camadas + leve elevação no hover para separar bem os cards.
const CARD =
  "flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 " +
  "shadow-[0_1px_2px_rgba(16,24,40,0.06),0_2px_6px_rgba(16,24,40,0.08)] " +
  "hover:shadow-[0_6px_18px_rgba(16,24,40,0.12)] hover:-translate-y-px transition-all";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Iniciais p/ o avatar (estilo Trello): 1ª + última palavra do nome.
function initials(name: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/).filter(Boolean);
  const s = (p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "");
  return s.toUpperCase() || "?";
}

function Avatar({ name }: { name: string | null }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-[var(--navy)] shrink-0"
      style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
      title={name ?? undefined}
    >
      {initials(name)}
    </div>
  );
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
// Item normalizado do feed — origem 'comment' (nota geral) ou 'event' (timeline).
type FeedItem =
  | {
      kind: "comment";
      id: string;
      created_at: string;
      body: string;
      author: string | null;
      edited: boolean;
      createdBy: string | null;
    }
  | {
      kind: "event";
      id: string;
      created_at: string;
      event: CaseEvent;
      manual: boolean;
    };

export function CaseFeed({ caseId }: { caseId: string }) {
  const { profile, role } = useAuth();
  const currentUserId = profile?.id ?? null;
  const isAdmin = role === "admin";

  const eventsQuery = useCaseEvents(caseId);
  const notesQuery = useCaseNotes(caseId);
  // L1 — mesmo de-para slug → rótulo usado no CaseTimeline (fonte única).
  const { data: caso } = useCase(caseId);
  const serviceTypeId = (caso as { service_type_id?: string } | undefined)?.service_type_id ?? "";
  const { data: stagesOp } = useStages(serviceTypeId, "op");
  const { data: stagesFin } = useStages(serviceTypeId, "fin");
  // BUG 1a (Thiago, 04/09): "os comentários automaticos indo robotizados" —
  // "Mudou de etapa: 3 dias follow up mt7bl3x2nssp → ...". O slug com sufixo é de
  // etapa de kanban CUSTOM, e aqui só vinham as do kanban principal e do
  // financeiro (`listStages` filtra `board_id IS NULL` de propósito). Sem a etapa
  // na lista, o resolvedor caía no formatador de slug e o sufixo técnico vazava
  // para a linha do tempo.
  const { data: stageLabels } = useAllStageLabels(serviceTypeId);
  const resolveEtapa = useMemo(
    () =>
      makeStageLabelResolver([stagesOp, stagesFin, stageLabels], MACRO_OP_LABELS, MACRO_FIN_LABELS),
    [stagesOp, stagesFin, stageLabels],
  );

  const create = useCreateCaseNote(caseId);
  const updateNote = useUpdateNote("case", caseId);
  const removeNote = useSoftDeleteNote("case", caseId);
  const updateEvent = useUpdateManualCaseEvent(caseId);
  const removeEvent = useDeleteManualCaseEvent(caseId);

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ kind: "comment" | "event"; id: string } | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "comment" | "event";
    id: string;
  } | null>(null);
  // #7 (2026-08-17) — alternar entre "só manuais" (comentários + marcos) e "tudo"
  // (inclui eventos automáticos/sistêmicos). Default = mostra tudo.
  // BUG 1b (Thiago, 04/09): "a visualização padrão nessa parte de andamentos ser
  // o 'só manuais' (continua o tudo, só que deixa de ser a opção padrão de
  // visualização quando abrimos)". O que a pessoa escreveu vale mais que o log
  // automático; quem quiser o histórico completo troca no botão ao lado.
  const [showSystemic, setShowSystemic] = useState(false);

  // D-M1a / F1 — feed = eventos (sem `fin_*` e sem `note_added`) + notas 'geral',
  // ordenado por created_at DESC (mais recente no topo, como a timeline atual).
  const feed: FeedItem[] = useMemo(() => {
    const events = ((eventsQuery.data ?? []) as CaseEvent[])
      // AU1 — `canonical_fields_updated` também sai daqui (vive no menu Auditoria).
      .filter(
        (e) =>
          !e.action.startsWith("fin_") &&
          e.action !== "note_added" &&
          e.action !== "canonical_fields_updated",
      )
      .map<FeedItem>((e) => ({
        kind: "event",
        id: e.id,
        created_at: e.created_at,
        event: e,
        manual: isManualEvent(e),
      }));
    const notes = (notesQuery.data ?? []).map<FeedItem>((n) => ({
      kind: "comment",
      id: n.id,
      created_at: n.created_at,
      body: n.body,
      author: n.created_by_name ?? null,
      edited: n.updated_at !== n.created_at,
      createdBy: n.created_by ?? null,
    }));
    return [...events, ...notes].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [eventsQuery.data, notesQuery.data]);

  const loading = eventsQuery.isLoading || notesQuery.isLoading;

  // #7 — quando "só manuais", esconde eventos AUTOMÁTICOS (mantém comentários e
  // marcos/notas manuais).
  const visibleFeed = useMemo(
    () =>
      showSystemic
        ? feed
        : feed.filter((it) => it.kind === "comment" || (it.kind === "event" && it.manual)),
    [feed, showSystemic],
  );

  async function handleCreate() {
    const body = draft.trim();
    if (!body) {
      toast.error("O comentário não pode ficar vazio");
      return;
    }
    try {
      await create.mutateAsync(body);
      setDraft("");
      toast.success("Comentário adicionado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao comentar");
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    const body = editBody.trim();
    if (!body) {
      toast.error("O texto não pode ficar vazio");
      return;
    }
    try {
      if (editing.kind === "comment") {
        await updateNote.mutateAsync({ noteId: editing.id, body });
      } else {
        await updateEvent.mutateAsync({ eventId: editing.id, body });
      }
      setEditing(null);
      setEditBody("");
      toast.success("Atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao editar");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.kind === "comment") {
        await removeNote.mutateAsync(confirmDelete.id);
      } else {
        await removeEvent.mutateAsync(confirmDelete.id);
      }
      setConfirmDelete(null);
      toast.success("Removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  const savingEdit = updateNote.isPending || updateEvent.isPending;
  const deleting = removeNote.isPending || removeEvent.isPending;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[24px] font-semibold text-[var(--navy)]">
          Andamentos do caso
        </h2>
        {/* #7 — filtro: só manuais × incluir movimentações do sistema. */}
        <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden text-[12px] font-medium">
          <button
            type="button"
            onClick={() => setShowSystemic(false)}
            className={`px-3 py-1.5 transition-colors ${
              !showSystemic ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)]"
            }`}
          >
            Só manuais
          </button>
          <button
            type="button"
            onClick={() => setShowSystemic(true)}
            className={`px-3 py-1.5 transition-colors border-l border-[var(--border)] ${
              showSystemic ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)]"
            }`}
          >
            Tudo
          </button>
        </div>
      </div>

      {/* Caixa de comentário — cria uma nota 'geral' (aparece no feed na hora).
          #7: altura dinâmica (cresce com o texto até ~400px). */}
      <div className="card-editorial p-4 mb-4">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 400)}px`;
          }}
          placeholder="Escreva um comentário, andamento ou observação pontual deste caso…"
          rows={4}
          className="resize-y min-h-[110px]"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleCreate} disabled={create.isPending || !draft.trim()}>
            {create.isPending ? "Salvando…" : "Adicionar"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : visibleFeed.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">
          {showSystemic ? "Nada registrado ainda." : "Nenhum comentário manual ainda."}
        </p>
      ) : (
        <ul className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
          {visibleFeed.map((item) => {
            const beingEdited = editing?.kind === item.kind && editing.id === item.id;

            // ── Comentário manual (nota 'geral') — cartão estilo Trello ──────────
            if (item.kind === "comment") {
              // Regra Trello (UI): autor edita+exclui; admin só exclui.
              const isOwner = !!currentUserId && item.createdBy === currentUserId;
              const canEdit = isOwner;
              const canDelete = isOwner || isAdmin;
              return (
                <li key={`c-${item.id}`} className={CARD}>
                  <Avatar name={item.author} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <span className="text-[13px] font-semibold text-[var(--navy)]">
                        {item.author ?? "—"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtDateTime(item.created_at)}
                      </span>
                      {item.edited && (
                        <span className="text-[11px] text-muted-foreground">· editada</span>
                      )}
                    </div>
                    {beingEdited ? (
                      <EditForm
                        value={editBody}
                        onChange={setEditBody}
                        onCancel={() => {
                          setEditing(null);
                          setEditBody("");
                        }}
                        onSave={handleUpdate}
                        saving={savingEdit}
                      />
                    ) : (
                      <>
                        <div className="text-[13.5px] text-[var(--navy)] whitespace-pre-wrap break-words">
                          {item.body}
                        </div>
                        {(canEdit || canDelete) && (
                          <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground pl-1">
                            {canEdit && (
                              <button
                                type="button"
                                className="hover:underline hover:text-[var(--navy)] transition-colors"
                                onClick={() => {
                                  setEditing({ kind: "comment", id: item.id });
                                  setEditBody(item.body);
                                }}
                              >
                                Editar
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="hover:underline hover:text-destructive transition-colors"
                                onClick={() => setConfirmDelete({ kind: "comment", id: item.id })}
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            }

            // ── Marco / nota manual (system_case_events) — mesmo cartão Trello ───
            const e = item.event;
            if (item.manual) {
              return (
                <li key={`e-${item.id}`} className={CARD}>
                  <Avatar name={e.triggered_by_name ?? null} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <span className="text-[13px] font-semibold text-[var(--navy)]">
                        {e.triggered_by_name ?? "—"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--gold-700)]">
                        {e.action === "marco" ? "Marco" : "Nota"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtDateTime(item.created_at)}
                      </span>
                    </div>
                    {beingEdited ? (
                      <EditForm
                        value={editBody}
                        onChange={setEditBody}
                        onCancel={() => {
                          setEditing(null);
                          setEditBody("");
                        }}
                        onSave={handleUpdate}
                        saving={savingEdit}
                      />
                    ) : (
                      <>
                        <div className="text-[13.5px] text-[var(--navy)] whitespace-pre-wrap break-words">
                          {renderEventLabel(e, resolveEtapa)}
                        </div>
                        <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground pl-1">
                          <button
                            type="button"
                            className="hover:underline hover:text-[var(--navy)] transition-colors"
                            onClick={() => {
                              setEditing({ kind: "event", id: item.id });
                              setEditBody((e.diff as { body?: string } | null)?.body ?? "");
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="hover:underline hover:text-destructive transition-colors"
                            onClick={() => setConfirmDelete({ kind: "event", id: item.id })}
                          >
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            }

            // ── Evento AUTOMÁTICO — card read-only (mesmo alto relevo) ───────────
            return (
              <li key={`e-${item.id}`} className={CARD}>
                <Avatar name={e.triggered_by_name ?? null} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                    {e.triggered_by_name && (
                      <span className="text-[13px] font-semibold text-[var(--navy)]">
                        {e.triggered_by_name}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {fmtDateTime(item.created_at)}
                    </span>
                  </div>
                  <div className="text-[13px] text-[var(--navy)]/80 whitespace-pre-wrap break-words">
                    {renderEventLabel(e, resolveEtapa)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este item?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.kind === "comment"
                ? "O comentário some da lista (soft-delete). O histórico de quem escreveu e excluiu é preservado para auditoria."
                : "Apenas marcos/notas manuais podem ser removidos. Eventos automáticos do sistema são somente-leitura."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditForm({
  value,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="resize-y"
        autoFocus
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || !value.trim()}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
