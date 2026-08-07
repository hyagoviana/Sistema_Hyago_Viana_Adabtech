import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, CheckCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { useAuth } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { activateUserFn, updateUserProfileFn } from "@/rpc/users";
import symbolHV from "@/assets/symbol-hv.png";

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // null = ainda processando o token do hash; true/false = resultado.
  const [tokenReady, setTokenReady] = useState<boolean | null>(null);

  // O link do e-mail (convite/reset) traz o token no HASH (#access_token=...&
  // refresh_token=...&type=invite). O client do @supabase/ssr NÃO processa o hash
  // sozinho — então lemos o hash e estabelecemos a sessão manualmente. Sem isso a
  // sessão nunca é criada e a página mostrava "Link inválido" mesmo com link bom.
  useEffect(() => {
    const raw = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(raw);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      getSupabaseBrowserClient()
        .auth.setSession({ access_token, refresh_token })
        .then(({ error: sErr }) => {
          setTokenReady(!sErr);
          // Remove o token da URL (não deixa vazar em histórico/print).
          if (!sErr) window.history.replaceState(null, "", window.location.pathname);
        })
        .catch(() => setTokenReady(false));
    } else {
      setTokenReady(false); // sem token no hash — depende de sessão já existente
    }
  }, []);

  const processing = tokenReady === null || loading;
  const hasSession = tokenReady === true || !!session;
  const linkInvalido = !processing && !hasSession;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    const fullName = String(fd.get("full_name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
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
        "Não foi possível salvar a senha. O link pode ter expirado · solicite um novo.",
      );
      return;
    }

    // Salva os dados do onboarding (nome/telefone). Não bloqueia o acesso se falhar.
    try {
      await updateUserProfileFn({
        data: { full_name: fullName || undefined, phone: phone || undefined },
      });
    } catch {
      /* admin pode ajustar depois na aba de Permissões */
    }

    // Ativa usuário convidado (INVITED → ACTIVE). Falha não bloqueia acesso.
    try {
      await activateUserFn();
    } catch {
      /* admin pode ajustar manualmente se necessário */
    }

    setSuccess(true);
    toast.success("Senha definida com sucesso!");
    setTimeout(() => navigate({ to: "/hoje" }), 2000);
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
          <p className="font-display text-[29px] leading-[1.28] text-white/95">
            Seu acesso é pessoal, restrito e auditado. Defina uma senha forte.
          </p>
          <footer
            className="mt-6 text-sm tracking-[0.18em] uppercase"
            style={{ color: "rgba(201,166,52,0.85)" }}
          >
            Hyago Viana · OAB/AL
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

          {loading ? (
            <div className="text-center">
              <p className="text-muted-foreground">Validando o link...</p>
            </div>
          ) : linkInvalido ? (
            <div className="text-center">
              <Eyebrow>Link inválido</Eyebrow>
              <h1 className="font-display text-[28px] font-semibold text-[var(--navy)] mt-4 mb-3 leading-tight">
                Link expirado ou inválido
              </h1>
              <p className="text-muted-foreground mb-8 text-[15px]">
                Este link de acesso é inválido ou já expirou. Solicite um novo link de recuperação ou peça um novo convite ao administrador.
              </p>
              <Link
                to="/recuperar-senha"
                className="inline-flex items-center justify-center w-full px-5 py-3.5 text-white font-semibold transition-all hover:-translate-y-0.5"
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
              <Eyebrow>Senha definida</Eyebrow>
              <h1 className="font-display text-[28px] font-semibold text-[var(--navy)] mt-4 mb-3 leading-tight">
                Senha definida com sucesso!
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
              <Eyebrow>Complete seu cadastro</Eyebrow>
              <h1 className="font-display text-[34px] font-semibold text-[var(--navy)] mt-4 mb-2 leading-tight">
                Bem-vindo(a)
              </h1>
              <p className="text-muted-foreground mb-10">
                Confirme seus dados e defina uma senha (mínimo 6 caracteres) para acessar o sistema.
              </p>

              <div className="space-y-5">
                <TextField label="Nome completo" name="full_name" placeholder="Seu nome completo" />
                <TextField label="Telefone" name="phone" placeholder="(82) 99999-9999" />
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
          )}

          <p className="mt-10 text-center text-[11.5px] text-muted-foreground/70">
            Protegido por autenticação e auditoria de acesso.
          </p>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder: string;
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
        <input
          name={name}
          type="text"
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 text-[15px] focus:outline-none placeholder:text-[var(--ink-400)]"
          style={{ appearance: "none" }}
        />
      </div>
    </label>
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
          minLength={6}
          required
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
