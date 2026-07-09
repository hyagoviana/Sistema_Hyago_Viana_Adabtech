// S4-03 — Bloco de notas reusável (cliente e caso).
// Auth-only: qualquer usuário autenticado cria/edita/exclui (sem gate por cargo).
// Exclusão é SOFT-DELETE no servidor (nunca hard-delete). Mostra autor + data.

import { Pencil, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
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
  useClientNotes,
  useCreateCaseNote,
  useCreateClientNote,
  useSoftDeleteNote,
  useUpdateNote,
  type NoteTarget,
} from "@/hooks/useNotes";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function NotesBlock({ target, entityId }: { target: NoteTarget; entityId: string }) {
  const caseNotes = useCaseNotes(target === "case" ? entityId : "");
  const clientNotes = useClientNotes(target === "client" ? entityId : "");
  const query = target === "case" ? caseNotes : clientNotes;

  const createCase = useCreateCaseNote(entityId);
  const createClient = useCreateClientNote(entityId);
  const update = useUpdateNote(target, entityId);
  const remove = useSoftDeleteNote(target, entityId);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notes = query.data ?? [];
  const creating = target === "case" ? createCase.isPending : createClient.isPending;

  async function handleCreate() {
    const body = draft.trim();
    if (!body) {
      toast.error("A nota não pode ficar vazia");
      return;
    }
    try {
      if (target === "case") await createCase.mutateAsync(body);
      else await createClient.mutateAsync(body);
      setDraft("");
      toast.success("Nota adicionada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar nota");
    }
  }

  async function handleUpdate(noteId: string) {
    const body = editBody.trim();
    if (!body) {
      toast.error("A nota não pode ficar vazia");
      return;
    }
    try {
      await update.mutateAsync({ noteId, body });
      setEditingId(null);
      setEditBody("");
      toast.success("Nota atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar nota");
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await remove.mutateAsync(noteId);
      setConfirmDelete(null);
      toast.success("Nota excluída");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir nota");
    }
  }

  return (
    <div>
      <h2 className="font-display text-[24px] font-semibold text-[var(--navy)] mb-3 flex items-center gap-2">
        <StickyNote size={20} className="text-[var(--gold-700)]" /> Notas
      </h2>

      <div className="card-editorial p-4 mb-4">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            target === "case"
              ? "Registre um andamento, observação ou histórico deste caso…"
              : "Registre uma observação ou histórico deste cliente…"
          }
          rows={3}
          className="resize-y"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleCreate} disabled={creating || !draft.trim()}>
            {creating ? "Salvando…" : "Adicionar nota"}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">Nenhuma nota registrada ainda.</p>
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
                      {n.updated_at !== n.created_at && (
                        <span className="ml-2">(editada)</span>
                      )}
                    </div>
                  </div>
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
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta nota?</AlertDialogTitle>
            <AlertDialogDescription>
              A nota some da lista (soft-delete). O histórico de quem escreveu e excluiu é
              preservado para auditoria.
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
