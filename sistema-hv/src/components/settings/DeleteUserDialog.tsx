import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserWorkload, useDeleteUserWithReassign } from "@/hooks/useUsers";
import type { ReassignMapping } from "@/lib/users-service";

type UserLite = { id: string; full_name: string | null; email: string };

// Exclusão DEFINITIVA de colaborador (item por item). O admin reatribui cada
// trabalho vinculado ao colaborador para outra pessoa; ao confirmar, o usuário é
// removido do banco e do login (Auth) — perde acesso. Só admin abre isto.
export function DeleteUserDialog({
  userId,
  userName,
  users,
  open,
  onOpenChange,
}: {
  userId: string | null;
  userName: string;
  users: UserLite[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: workload, isLoading } = useUserWorkload(open ? userId : null);
  const del = useDeleteUserWithReassign();
  // Destino escolhido por linha. Chave = `${tipo}:${id}`.
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");

  useEffect(() => {
    if (open) {
      setTargets({});
      setBulk("");
    }
  }, [open, userId]);

  // Candidatos a receber o trabalho: todos menos o que será excluído.
  const candidates = useMemo(
    () => users.filter((u) => u.id !== userId),
    [users, userId],
  );
  const nameOf = (u: UserLite) => u.full_name || u.email.split("@")[0];

  // Todas as linhas (chave estável) que precisam de destino.
  const rows = useMemo(() => {
    if (!workload) return [] as string[];
    return [
      ...workload.responsaveis.map((r) => `resp:${r.case_id}`),
      ...workload.casesCreated.map((c) => `case:${c.case_id}`),
      ...workload.clientsCreated.map((c) => `client:${c.client_id}`),
      ...workload.tasks.map((t) => `task:${t.id}`),
      ...workload.checklist.map((it) => `chk:${it.id}`),
    ];
  }, [workload]);

  const allAssigned = rows.length > 0 && rows.every((k) => targets[k]);
  const nothingToReassign = rows.length === 0;

  function applyBulk(to: string) {
    setBulk(to);
    if (!to) return;
    setTargets(() => Object.fromEntries(rows.map((k) => [k, to])));
  }

  async function confirm() {
    if (!userId || !workload) return;
    if (!nothingToReassign && !allAssigned) {
      toast.error("Escolha para quem vai cada item antes de excluir.");
      return;
    }
    const mapping: ReassignMapping = {
      responsaveis: workload.responsaveis.map((r) => ({
        case_id: r.case_id,
        to: targets[`resp:${r.case_id}`],
      })),
      casesCreated: workload.casesCreated.map((c) => ({
        case_id: c.case_id,
        to: targets[`case:${c.case_id}`],
      })),
      clientsCreated: workload.clientsCreated.map((c) => ({
        client_id: c.client_id,
        to: targets[`client:${c.client_id}`],
      })),
      tasks: workload.tasks.map((t) => ({ id: t.id, to: targets[`task:${t.id}`] })),
      checklist: workload.checklist.map((it) => ({ id: it.id, to: targets[`chk:${it.id}`] })),
    };
    try {
      await del.mutateAsync({ userId, mapping });
      toast.success(`${userName} foi excluído e o trabalho foi reatribuído.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir colaborador.");
    }
  }

  function RowSelect({ k }: { k: string }) {
    return (
      <Select value={targets[k] ?? ""} onValueChange={(v) => setTargets((s) => ({ ...s, [k]: v }))}>
        <SelectTrigger className="h-8 w-[190px]">
          <SelectValue placeholder="Reatribuir para…" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {nameOf(u)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function Section({
    title,
    items,
  }: {
    title: string;
    items: { key: string; label: string; sub?: string }[];
  }) {
    if (items.length === 0) return null;
    return (
      <div>
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {title} ({items.length})
        </h4>
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--navy)] truncate">{it.label}</div>
                {it.sub && <div className="text-[11px] text-muted-foreground truncate">{it.sub}</div>}
              </div>
              <RowSelect k={it.key} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--danger,#b4232a)]">
            <AlertTriangle size={18} /> Excluir {userName}
          </DialogTitle>
          <DialogDescription>
            Reatribua cada trabalho vinculado a este colaborador. Ao confirmar, ele é removido do
            sistema e perde o acesso à plataforma — esta ação é permanente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
            <Loader2 size={16} className="animate-spin" /> Levantando o que está vinculado…
          </div>
        ) : nothingToReassign ? (
          <div className="rounded-md border border-[var(--border)] bg-black/[0.02] px-3 py-4 text-sm text-muted-foreground">
            Nada vinculado a este colaborador. Pode excluir com segurança.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Atalho: preencher tudo de uma vez (ainda dá pra ajustar linha a linha). */}
            <div className="flex items-center gap-2 rounded-md bg-[var(--gold-50,#faf6ea)] border border-[var(--border)] px-3 py-2">
              <span className="text-[12px] text-muted-foreground shrink-0">Atribuir tudo a:</span>
              <Select value={bulk} onValueChange={applyBulk}>
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder="Escolher pessoa…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {nameOf(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground">
                (depois dá pra mudar item a item)
              </span>
            </div>

            <Section
              title="Casos como responsável"
              items={(workload?.responsaveis ?? []).map((r) => ({
                key: `resp:${r.case_id}`,
                label: r.case_code,
                sub: r.client_name,
              }))}
            />
            <Section
              title="Casos criados por ele"
              items={(workload?.casesCreated ?? []).map((c) => ({
                key: `case:${c.case_id}`,
                label: c.case_code,
                sub: c.client_name,
              }))}
            />
            <Section
              title="Clientes criados por ele"
              items={(workload?.clientsCreated ?? []).map((c) => ({
                key: `client:${c.client_id}`,
                label: c.client_name,
              }))}
            />
            <Section
              title="Tarefas"
              items={(workload?.tasks ?? []).map((t) => ({
                key: `task:${t.id}`,
                label: t.title,
                sub: t.case_code,
              }))}
            />
            <Section
              title="Itens de checklist"
              items={(workload?.checklist ?? []).map((it) => ({
                key: `chk:${it.id}`,
                label: it.label,
                sub: it.case_code,
              }))}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={del.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={confirm}
            disabled={del.isPending || isLoading || (!nothingToReassign && !allAssigned)}
            className="bg-[#b4232a] hover:bg-[#9a1d23] text-white"
          >
            {del.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
            Excluir colaborador definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
