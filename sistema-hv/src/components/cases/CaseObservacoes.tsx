// #6 (2026-08-17) — Observações gerais do caso no MODELO da linha do tempo
// (cada observação vira uma entrada com autor + data), substituindo o antigo
// campo de texto único (system_cases.observacoes). Grava como nota scope=
// 'observacao' (painel próprio; NÃO entra na linha do tempo principal). O texto
// legado do caso (se houver) aparece como registro histórico read-only no fim.

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import {
  useCaseObsNotes,
  useCreateCaseObsNote,
  useUpdateCaseObsNote,
  useSoftDeleteCaseObsNote,
} from "@/hooks/useNotes";

type ObsNote = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function CaseObservacoes({
  caseId,
  legacyText,
  canEdit,
}: {
  caseId: string;
  legacyText?: string | null;
  canEdit: boolean;
}) {
  const { profile, role } = useAuth();
  const currentUserId = profile?.id ?? null;
  const isAdmin = role === "admin";

  const { data, isLoading } = useCaseObsNotes(caseId);
  const notes = (data ?? []) as ObsNote[];
  const create = useCreateCaseObsNote(caseId);
  const update = useUpdateCaseObsNote(caseId);
  const remove = useSoftDeleteCaseObsNote(caseId);

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  async function handleCreate() {
    const body = draft.trim();
    if (!body) return;
    try {
      await create.mutateAsync(body);
      setDraft("");
      toast.success("Observação adicionada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    try {
      await update.mutateAsync({ noteId: editing.id, body });
      setEditing(null);
      toast.success("Observação atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao editar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta observação?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Observação removida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  const hasLegacy = !!legacyText && legacyText.trim().length > 0;

  return (
    <div>
      <Eyebrow>Observações gerais</Eyebrow>
      <p className="text-[12px] text-muted-foreground mt-1 mb-3">
        Informações específicas do caso, registradas com autor e data (separado da linha do tempo).
      </p>

      {canEdit && (
        <div className="card-editorial p-4 mb-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 400)}px`;
            }}
            placeholder="Escreva uma observação sobre este caso…"
            rows={3}
            className="resize-y min-h-[90px]"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={create.isPending || !draft.trim()}>
              {create.isPending ? "Salvando…" : "Adicionar observação"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.length === 0 && !hasLegacy ? (
        <p className="text-sm text-muted-foreground px-1">Nenhuma observação ainda.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const isOwner = !!currentUserId && n.created_by === currentUserId;
            const canModify = isOwner;
            const canRemove = isOwner || isAdmin;
            const beingEdited = editing?.id === n.id;
            return (
              <li key={n.id} className="rounded-[10px] border border-[var(--border)] bg-white p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--muted)] text-[10px] font-semibold text-[var(--navy)]">
                    {initials(n.created_by_name)}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--navy)]">
                    {n.created_by_name ?? "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmt(n.created_at)}
                    {n.updated_at !== n.created_at ? " · editado" : ""}
                  </span>
                </div>
                {beingEdited ? (
                  <div>
                    <Textarea
                      value={editing.body}
                      onChange={(e) => setEditing({ id: n.id, body: e.target.value })}
                      rows={3}
                      className="resize-y"
                    />
                    <div className="mt-2 flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleUpdate} disabled={update.isPending}>
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] text-[var(--navy)] whitespace-pre-wrap">{n.body}</p>
                    {canEdit && (canModify || canRemove) && (
                      <div className="mt-1.5 flex gap-3 text-[11px]">
                        {canModify && (
                          <button
                            type="button"
                            className="text-[var(--gold-700)] hover:underline"
                            onClick={() => setEditing({ id: n.id, body: n.body })}
                          >
                            Editar
                          </button>
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            className="text-destructive hover:underline"
                            onClick={() => handleDelete(n.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}

          {/* Observação legada (campo antigo system_cases.observacoes) — histórico
              read-only, preservado sem migração de dados. */}
          {hasLegacy && (
            <li className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Registro anterior (histórico)
              </div>
              <p className="text-[13px] text-[var(--navy)] whitespace-pre-wrap">{legacyText}</p>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
