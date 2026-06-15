import { Eye, EyeOff, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { updatePasswordFn } from "@/rpc/users";

export function ChangePasswordSection() {
  const updatePassword = useServerFn(updatePasswordFn);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword({ data: { newPassword } });
      toast.success("Senha alterada com sucesso!");
      e.currentTarget.reset();
      setShowNew(false);
      setShowConfirm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card-editorial !p-5 mb-5">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--gold-700)] mb-4">
        Alterar senha
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <PasswordInput
          label="Nova senha"
          name="newPassword"
          show={showNew}
          onToggle={() => setShowNew(!showNew)}
        />
        <PasswordInput
          label="Confirmar nova senha"
          name="confirm"
          show={showConfirm}
          onToggle={() => setShowConfirm(!showConfirm)}
        />

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-md transition-all hover:-translate-y-0.5 disabled:opacity-60"
          style={{
            background: "linear-gradient(180deg, #b1902a 0%, #987814 55%, #856611 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 20px -8px rgba(152,120,20,0.5)",
          }}
        >
          <Lock size={14} />
          {loading ? "Salvando…" : "Alterar senha"}
        </button>
      </form>
    </section>
  );
}

function PasswordInput({
  label,
  name,
  show,
  onToggle,
}: {
  label: string;
  name: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground mb-1.5">
        {label}
      </span>
      <div
        className="flex items-center gap-2 px-3 rounded-lg transition-all focus-within:border-[var(--gold)]"
        style={{
          background: "#fcfbf8",
          border: "1px solid rgba(120,96,30,0.16)",
          boxShadow: "inset 0 1px 2px rgba(60,50,20,0.03)",
        }}
      >
        <Lock size={14} className="text-[var(--ink-400)] shrink-0" />
        <input
          name={name}
          type={show ? "text" : "password"}
          placeholder="••••••••"
          className="flex-1 bg-transparent py-2.5 text-[14px] focus:outline-none placeholder:text-[var(--ink-400)]"
        />
        <button
          type="button"
          onClick={onToggle}
          className="text-[var(--ink-400)] hover:text-[var(--gold-700)] shrink-0"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </label>
  );
}
