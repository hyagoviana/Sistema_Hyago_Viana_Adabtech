// G4 — Gestão do SIGILO do caso: toggle "Sigiloso" + seletor de usuários
// autorizados a ver o submenu Judicial. Só aparece para quem pode gerir o caso
// (admin / operacional:edit). O gate real é no servidor (setCaseSigiloFn).
//
// Regra prática: ao LIGAR o sigilo, pré-selecionamos o próprio usuário (evita
// auto-trancamento — o criador/responsável já entram pela regra, mas a UI
// reforça). Autorizados são escolhidos de system_users.

import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCaseSigiloStatus } from "@/hooks/useJudicial";
import { useSetCaseSigilo } from "@/hooks/useCases";
import { useAssignableUsers } from "@/hooks/useUsers";
import { useAuth } from "@/lib/auth";

export function CaseSigiloSection({ caseId }: { caseId: string }) {
  const { profile } = useAuth();
  const { data: status } = useCaseSigiloStatus(caseId);
  const { data: users } = useAssignableUsers();
  const save = useSetCaseSigilo(caseId);

  const [sigiloso, setSigiloso] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Sincroniza o estado local quando o status carrega/muda.
  useEffect(() => {
    if (!status) return;
    setSigiloso(status.sigiloso);
    setSelected(new Set(status.autorizados));
  }, [status]);

  function toggleSigiloso(v: boolean) {
    setSigiloso(v);
    if (v && profile?.id) {
      // Pré-seleciona o próprio usuário ao ligar (anti auto-trancamento).
      setSelected((prev) => new Set(prev).add(profile.id));
    }
  }

  function toggleUser(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    try {
      await save.mutateAsync({ sigiloso, userIds: [...selected] });
      toast.success("Sigilo atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar sigilo");
    }
  }

  // M17 — só usuários ATIVOS podem autorizar sigilo (arquivados não entram).
  const userList = (
    (users ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
      status: string;
    }>
  ).filter((u) => u.status === "ACTIVE");

  return (
    <div className="card-hero p-7">
      <div className="flex items-center gap-2">
        <Lock size={16} className="text-[var(--gold-700)]" />
        <Eyebrow>Sigilo do caso</Eyebrow>
      </div>
      <p className="text-[13px] text-muted-foreground mt-2">
        Casos sigilosos só mostram o submenu Judicial ao administrador e aos usuários autorizados.
        Casos normais são visíveis a todos.
      </p>

      <label className="mt-4 flex items-center gap-2 cursor-pointer">
        <Checkbox checked={sigiloso} onCheckedChange={(v) => toggleSigiloso(v === true)} />
        <span className="text-[14px] font-medium text-[var(--navy)]">Marcar como sigiloso</span>
      </label>

      {sigiloso && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Usuários autorizados
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
            {userList.length === 0 ? (
              <div className="p-3 text-[13px] text-muted-foreground">Nenhum usuário.</div>
            ) : (
              userList.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--cream)]"
                >
                  <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                  <span className="text-[13px] text-[var(--navy)]">{u.full_name || u.email}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar sigilo"}
        </Button>
      </div>
    </div>
  );
}
