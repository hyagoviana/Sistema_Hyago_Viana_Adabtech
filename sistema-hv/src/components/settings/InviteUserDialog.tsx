import { useState } from "react";
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
import { useInviteUser } from "@/hooks/useUsers";
import { useSetUserModulePerms } from "@/hooks/usePermissions";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";

import { ModulePermsGrid, type ModulePermsValue } from "./ModulePermsGrid";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// admin não é atribuível por convite — evita escalada acidental de privilégio.
const ASSIGNABLE: Role[] = ROLES.filter((r) => r !== "admin");

export function InviteUserDialog({ open, onOpenChange }: Props) {
  const invite = useInviteUser();
  const setPerms = useSetUserModulePerms();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("operacional");
  // Overrides por aba definidos JÁ no convite (2026-07-19). Vazio = tudo no
  // padrão do papel escolhido.
  const [modulePerms, setModulePerms] = useState<ModulePermsValue>({ access: {}, values: {} });

  function reset() {
    setEmail("");
    setFullName("");
    setRole("operacional");
    setModulePerms({ access: {}, values: {} });
  }

  async function handleConfirm() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    try {
      const created = await invite.mutateAsync({
        email: cleanEmail,
        full_name: fullName.trim() || undefined,
        role,
        redirectTo: `${window.location.origin}/nova-senha`,
      });
      // Grava os overrides por aba definidos no convite. O usuário já existe em
      // system_users (status INVITED), então o user_id está disponível. Se essa
      // etapa falhar, o convite já foi enviado — avisamos sem reverter.
      const hasOverrides =
        Object.values(modulePerms.access).some((v) => v != null) ||
        Object.values(modulePerms.values).some((v) => v != null);
      if (created?.id && hasOverrides) {
        try {
          await setPerms.mutateAsync({
            userId: created.id,
            access: modulePerms.access,
            values: modulePerms.values,
          });
        } catch {
          toast.warning(
            "Convite enviado, mas não consegui salvar as permissões por aba. Ajuste na tela de Permissões.",
          );
          reset();
          onOpenChange(false);
          return;
        }
      }
      toast.success(`Convite enviado para ${cleanEmail}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao convidar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : (reset(), onOpenChange(o)))}>
      <DialogContent className="sm:max-w-[480px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            Enviamos um e-mail de convite. O acesso fica restrito ao papel e às permissões por aba
            escolhidas abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-[12.5px] font-medium text-[var(--navy)] mb-1">E-mail</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@escritorio.com"
              className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <p className="text-[12.5px] font-medium text-[var(--navy)] mb-1">Nome (opcional)</p>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <p className="text-[12.5px] font-medium text-[var(--navy)] mb-1">Papel</p>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <ModulePermsGrid
              value={modulePerms}
              onChange={setModulePerms}
              disabled={invite.isPending || setPerms.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={invite.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={invite.isPending}>
            {invite.isPending ? "Enviando…" : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
