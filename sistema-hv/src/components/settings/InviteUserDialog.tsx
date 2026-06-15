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
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// admin não é atribuível por convite — evita escalada acidental de privilégio.
const ASSIGNABLE: Role[] = ROLES.filter((r) => r !== "admin");

export function InviteUserDialog({ open, onOpenChange }: Props) {
  const invite = useInviteUser();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("operacional");

  function reset() {
    setEmail("");
    setFullName("");
    setRole("operacional");
  }

  async function handleConfirm() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    try {
      await invite.mutateAsync({
        email: cleanEmail,
        full_name: fullName.trim() || undefined,
        role,
        redirectTo: `${window.location.origin}/nova-senha`,
      });
      toast.success(`Convite enviado para ${cleanEmail}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao convidar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : (reset(), onOpenChange(o)))}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            Enviamos um e-mail de convite. O acesso fica restrito ao papel escolhido.
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
