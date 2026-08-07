// F1 — Bloco de COMENTÁRIOS EXCLUSIVOS DO FINANCEIRO (scope='financeiro').
// Mesma UX do NotesBlock, mas usa os hooks gate-ados por `financeiro` (view p/
// ler, edit p/ escrever/editar/excluir). Renderizado só dentro do submenu
// financeiro (a página inteira já exige financeiro:view). Quem não tem
// financeiro:view nunca vê nem lê estes comentários.

import { Pencil, MessageSquare, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCaseFinNotes,
  useCreateCaseFinNote,
  useSoftDeleteCaseFinNote,
  useUpdateCaseFinNote,
} from "@/hooks/useNotes";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function FinNotesBlock({ caseId, canEdit }: { caseId: string; canEdit: boolean }) {
  const query = useCaseFinNotes(caseId);
  const create = useCreateCaseFinNote(caseId);
  const update = useUpdateCaseFinNote(caseId);
  const remove = useSoftDeleteCaseFinNote(caseId);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notes = query.data ?? [];

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
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar comentário");
    }
  }

  async function handleUpdate(noteId: string) {
    const body = editBody.trim();
    if (!body) {
      toast.error("O comentário não pode ficar vazio");
      return;
    }
    try {
      await update.mutateAsync({ noteId, body });
      setEditingId(null);
      setEditBody("");
      toast.success("Comentário atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar comentário");
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await remove.mutateAsync(noteId);
      setConfirmDelete(null);
      toast.success("Comentário excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir comentário");
    }
  }

  return (
    <div>
      <h2 className="font-display text-[24px] font-semibold text-[var(--navy)] mb-3 flex items-center gap-2">
        <MessageSquare size={20} className="text-[var(--gold-700)]" /> Comentários do financeiro
      </h2>

      {canEdit && (
        <div className="card-editorial p-4 mb-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Registre uma observação financeira deste caso (parcelas, cobranças, conferência)…"
            rows={3}
            className="resize-y"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={create.isPending || !draft.trim()}>
              {create.isPending ? "Salvando…" : "Adicionar comentário"}
            </Button>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">Nenhum comentário financeiro ainda.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card-editorial p-4">
              {editingId === n.id ? (
                <div>
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
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
                      onClick={() => handleUpdate(n.id)}
                      disabled={update.isPending || !editBody.trim()}
                    >
                      {update.isPending ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] text-[var(--navy)] whitespace-pre-wrap break-words">
                      {n.body}
                    </p>
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      {fmtDateTime(n.created_at)}
                      {n.created_by_name && (
                        <span className="ml-2">
                          por <strong>{n.created_by_name}</strong>
                        </span>
                      )}
                      {n.updated_at !== n.created_at && <span className="ml-2">(editado)</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Editar"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditBody(n.body);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Excluir"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(n.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              O comentário some da lista (soft-delete). O histórico é preservado para auditoria.
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
