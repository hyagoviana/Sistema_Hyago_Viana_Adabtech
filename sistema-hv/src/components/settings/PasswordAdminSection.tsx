import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminSetUserPassword, useRequestPasswordReset } from "@/hooks/useUsers";

/**
 * Seção "Senha de acesso" do dialog de edição de colaborador (aba Permissões).
 * O admin pode:
 *  - Definir uma senha manualmente (com opção de exigir troca no próximo login);
 *  - Disparar o e-mail de redefinição (link → /nova-senha), reaproveitando o
 *    fluxo já existente.
 * O próprio colaborador também troca a senha em Configurações (auto-serviço).
 */
export function PasswordAdminSection({ userId, email }: { userId: string; email: string }) {
  const setPassword = useAdminSetUserPassword();
  const sendReset = useRequestPasswordReset();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [requireChange, setRequireChange] = useState(true);

  async function salvar() {
    if (pwd.trim().length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    try {
      await setPassword.mutateAsync({ userId, newPassword: pwd.trim(), requireChange });
      toast.success(
        requireChange
          ? "Senha definida. O colaborador terá de trocá-la no próximo login."
          : "Senha definida.",
      );
      setPwd("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao definir a senha.");
    }
  }

  async function enviarEmail() {
    try {
      await sendReset.mutateAsync({
        email,
        redirectTo: `${window.location.origin}/nova-senha`,
      });
      toast.success(`E-mail de redefinição enviado para ${email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar o e-mail.");
    }
  }

  return (
    <div className="border-t border-[var(--border)] pt-3 space-y-3">
      <p className="text-[12px] font-semibold text-[var(--navy)]">Senha de acesso</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <KeyRound size={14} />
          Definir senha manual
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={enviarEmail}
          disabled={sendReset.isPending}
        >
          <Mail size={14} />
          {sendReset.isPending ? "Enviando…" : "Enviar e-mail de redefinição"}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-md border border-[var(--border)] p-3">
          <div>
            <Label>Nova senha</Label>
            <Input
              type="text"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input
              type="checkbox"
              checked={requireChange}
              onChange={(e) => setRequireChange(e.target.checked)}
            />
            Exigir que o colaborador troque a senha no próximo login
          </label>
          <Button type="button" size="sm" onClick={salvar} disabled={setPassword.isPending}>
            {setPassword.isPending ? "Salvando…" : "Salvar senha"}
          </Button>
        </div>
      )}
    </div>
  );
}
