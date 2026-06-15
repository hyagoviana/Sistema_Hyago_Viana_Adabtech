import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, CheckCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Eyebrow } from "@/components/hv/primitives";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { updatePasswordFn } from "@/rpc/users";
import symbolHV from "@/assets/symbol-hv.png";

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const navigate = useNavigate();
  const updatePassword = useServerFn(updatePasswordFn);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // O Supabase redireciona com fragmento hash contendo access_token + refresh_token.
  // Precisamos trocar esse token por uma sessão válida antes de chamar updatePassword.
  useEffect(() => {
    const sb = getSupabaseBrowserClient();

    // onAuthStateChange captura o evento PASSWORD_RECOVERY ou SIGNED_IN
    // que o Supabase dispara ao processar o hash fragment
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (
        (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
        session
      ) {
        setSessionReady(true);
        setVerifying(false);
      }
    });

    // Fallback: se já houver sessão (ex: usuário logado clicou no link)
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
        setVerifying(false);
      } else {
        // Aguardar um pouco para o hash ser processado
        setTimeout(() => setVerifying(false), 3000);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword({ data: { newPassword: password } });
      setSuccess(true);
      // Redirecionar após 3s
      setTimeout(() => navigate({ to: "/hoje" }), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao alterar a senha.");
    } finally {
      setLoading(false);
    }
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
            A excelência jurídica começa pela disciplina dos detalhes.
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

          {verifying ? (
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Verificando link...</div>
            </div>
          ) : !sessionReady ? (
            <div className="text-center">
              <Eyebrow>Link inválido</Eyebrow>
              <h1 className="font-display text-[28px] font-semibold text-[var(--navy)] mt-4 mb-3 leading-tight">
                Link expirado ou inválido
              </h1>
              <p className="text-muted-foreground mb-8 text-[15px]">
                O link de recuperação pode ter expirado ou já foi utilizado. Solicite um novo link.
              </p>
              <Link
                to="/recuperar-senha"
                className="inline-flex items-center justify-center px-5 py-3 text-white font-semibold"
                style={{
                  background: "linear-gradient(180deg, #b1902a 0%, #987814 55%, #856611 100%)",
                  borderRadius: 8,
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 30px -10px rgba(152,120,20,0.6)",
                }}
              >
                Solicitar novo link
              </Link>
              <div className="mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--gold-700)]"
                >
                  <ArrowLeft size={14} />
                  Voltar para o login
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}>
                <CheckCircle size={28} className="text-[var(--navy)]" />
              </div>
              <Eyebrow>Senha alterada</Eyebrow>
              <h1 className="font-display text-[28px] font-semibold text-[var(--navy)] mt-4 mb-3 leading-tight">
                Senha redefinida com sucesso!
              </h1>
              <p className="text-muted-foreground mb-8 text-[15px]">
                Você será redirecionado automaticamente em instantes...
              </p>
              <Link
                to="/hoje"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--gold-700)] hover:text-[var(--gold)]"
              >
                Ir para o sistema
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Eyebrow>Nova senha</Eyebrow>
              <h1 className="font-display text-[34px] font-semibold text-[var(--navy)] mt-4 mb-2 leading-tight">
                Defina sua nova senha
              </h1>
              <p className="text-muted-foreground mb-10">
                Escolha uma senha segura com no mínimo 6 caracteres.
              </p>

              <div className="space-y-5">
                <PasswordField
                  label="Nova senha"
                  name="password"
                  placeholder="••••••••"
                  show={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
                <PasswordField
                  label="Confirmar senha"
                  name="confirm"
                  placeholder="••••••••"
                  show={showConfirm}
                  onToggle={() => setShowConfirm(!showConfirm)}
                />
              </div>

              {error && (
                <p className="mt-5 text-sm" role="alert" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-8 w-full inline-flex items-center justify-center px-5 py-3.5 text-white font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                style={{
                  background: "linear-gradient(180deg, #b1902a 0%, #987814 55%, #856611 100%)",
                  borderRadius: 8,
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 30px -10px rgba(152,120,20,0.6)",
                }}
              >
                {loading ? "Salvando…" : "Redefinir senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  name,
  placeholder,
  show,
  onToggle,
}: {
  label: string;
  name: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
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
        <span className="text-[var(--ink-400)]">
          <Lock size={16} />
        </span>
        <input
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 text-[15px] focus:outline-none placeholder:text-[var(--ink-400)]"
          style={{ appearance: "none" }}
        />
        <button type="button" onClick={onToggle} className="text-[var(--ink-400)] hover:text-[var(--gold-700)]">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}
