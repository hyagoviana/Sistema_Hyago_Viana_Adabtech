import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { useAuth } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { activateUserFn } from "@/rpc/users";
import symbolHV from "@/assets/symbol-hv.png";

export const Route = createFileRoute("/definir-senha")({
  component: DefinirSenhaPage,
});

function DefinirSenhaPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O link do e-mail (convite/reset) estabelece a sessão automaticamente
  // (detectSessionInUrl). Sem sessão após carregar → link inválido/expirado.
  const linkInvalido = !loading && !session;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (password.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    const { error: updErr } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updErr) {
      setSubmitting(false);
      setError(
        "Não foi possível salvar a senha. O link pode ter expirado — peça um novo convite ao administrador.",
      );
      return;
    }

    // Marca o perfil como ativo (INVITED → ACTIVE). O papel já foi definido no
    // convite e é preservado. Falha aqui não bloqueia o acesso.
    try {
      await activateUserFn();
    } catch {
      /* o admin pode ajustar o status manualmente se necessário */
    }

    toast.success("Senha definida com sucesso. Bem-vindo!");
    navigate({ to: "/hoje" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Painel de marca (esquerda) */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-14 text-white"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 24% 72%, rgba(58,62,116,0.32), transparent 60%), linear-gradient(160deg, #1c1e40 0%, #16182f 46%, #0e0f24 78%, #090a1a 100%)",
        }}
      >
        <div className="relative flex items-center gap-3">
          <img src={symbolHV} alt="" className="h-11 w-auto object-contain" />
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">Hyago Viana</div>
            <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "#c9a634" }}>
              Advocacia
            </div>
          </div>
        </div>

        <blockquote className="relative max-w-lg">
          <div className="text-2xl mb-5" style={{ color: "#c9a634" }}>
            ✦
          </div>
          <p className="font-display italic text-[29px] leading-[1.28] text-white/95">
            Seu acesso é pessoal, restrito e auditado. Defina uma senha forte.
          </p>
          <footer
            className="mt-6 text-sm tracking-[0.18em] uppercase"
            style={{ color: "rgba(201,166,52,0.85)" }}
          >
            — Hyago Viana · OAB/AL
          </footer>
        </blockquote>

        <div className="relative text-xs tracking-wider text-white/40">
          © 2026 Hyago Viana Advocacia · Acesso restrito e auditado
        </div>
      </div>

      {/* Formulário (direita) */}
      <div className="flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          <img
            src={symbolHV}
            alt="Hyago Viana Advocacia"
            className="h-10 w-auto object-contain mb-8 lg:hidden"
          />

          <Eyebrow>Primeiro acesso</Eyebrow>
          <h1 className="font-display text-[34px] font-semibold text-[var(--navy)] mt-4 mb-2 leading-tight">
            Defina sua senha
          </h1>

          {loading ? (
            <p className="text-muted-foreground mt-6">Validando o link…</p>
          ) : linkInvalido ? (
            <div className="mt-6">
              <p className="text-muted-foreground mb-6">
                Este link de acesso é inválido ou já expirou. Solicite um novo convite ao
                administrador ou use a opção de redefinir senha na tela de login.
              </p>
              <button
                onClick={() => navigate({ to: "/login" })}
                className="w-full inline-flex items-center justify-center px-5 py-3.5 text-white font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(180deg, #b1902a 0%, #987814 55%, #856611 100%)",
                  borderRadius: 8,
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 30px -10px rgba(152,120,20,0.6)",
                }}
              >
                Ir para o login
              </button>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-10">
                Crie uma senha para concluir seu acesso ao sistema. Use ao menos 8 caracteres.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="space-y-5">
                  <Field
                    label="Nova senha"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    icon={<Lock size={16} />}
                  />
                  <Field
                    label="Confirmar senha"
                    name="confirm"
                    type="password"
                    placeholder="••••••••"
                    icon={<Lock size={16} />}
                  />
                </div>

                {error && (
                  <p className="mt-5 text-sm" role="alert" style={{ color: "var(--danger)" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-8 w-full inline-flex items-center justify-center px-5 py-3.5 text-white font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{
                    background: "linear-gradient(180deg, #b1902a 0%, #987814 55%, #856611 100%)",
                    borderRadius: 8,
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 30px -10px rgba(152,120,20,0.6)",
                  }}
                >
                  {submitting ? "Salvando…" : "Salvar senha e entrar"}
                </button>
              </form>
            </>
          )}

          <p className="mt-10 text-center text-[11.5px] text-muted-foreground/70">
            Protegido por autenticação e auditoria de acesso.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  icon,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--gold-700)] mb-2">
        {label}
      </span>
      <div
        className="flex items-center gap-2.5 px-3.5 rounded-lg transition-all focus-within:border-[var(--gold)]"
        style={{
          background: "#fcfbf8",
          border: "1px solid rgba(120,96,30,0.16)",
          boxShadow: "inset 0 1px 2px rgba(60,50,20,0.03)",
        }}
      >
        {icon && <span className="text-[var(--ink-400)]">{icon}</span>}
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          minLength={8}
          required
          className="flex-1 bg-transparent py-3 text-[15px] focus:outline-none placeholder:text-[var(--ink-400)]"
          style={{ appearance: "none" }}
        />
      </div>
    </label>
  );
}
