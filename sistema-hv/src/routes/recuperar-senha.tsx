import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Eyebrow } from "@/components/hv/primitives";
import { requestPasswordResetFn } from "@/rpc/users";
import symbolHV from "@/assets/symbol-hv.png";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const requestReset = useServerFn(requestPasswordResetFn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();

    if (!email) {
      setError("Informe seu e-mail.");
      setLoading(false);
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/nova-senha`;
      await requestReset({ data: { email, redirectTo } });
      setSent(true);
    } catch {
      // Não revelamos se o e-mail existe ou não (segurança)
      setSent(true);
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

          {sent ? (
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}>
                <CheckCircle size={28} className="text-[var(--navy)]" />
              </div>
              <Eyebrow>E-mail enviado</Eyebrow>
              <h1 className="font-display text-[28px] font-semibold text-[var(--navy)] mt-4 mb-3 leading-tight">
                Verifique sua caixa de entrada
              </h1>
              <p className="text-muted-foreground mb-8 text-[15px]">
                Se o e-mail informado estiver cadastrado, você receberá um link para redefinir sua senha. Verifique também a pasta de spam.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--gold-700)] hover:text-[var(--gold)]"
              >
                <ArrowLeft size={16} />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[var(--gold-700)] mb-8"
              >
                <ArrowLeft size={14} />
                Voltar
              </Link>

              <Eyebrow>Recuperação de acesso</Eyebrow>
              <h1 className="font-display text-[34px] font-semibold text-[var(--navy)] mt-4 mb-2 leading-tight">
                Esqueceu sua senha?
              </h1>
              <p className="text-muted-foreground mb-10">
                Informe o e-mail vinculado à sua conta e enviaremos um link para redefinir sua senha.
              </p>

              <Field
                label="E-mail"
                name="email"
                type="email"
                placeholder="seu@hyagoviana.adv.br"
                icon={<Mail size={16} />}
              />

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
                {loading ? "Enviando…" : "Enviar link de recuperação"}
              </button>
            </form>
          )}
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
          className="flex-1 bg-transparent py-3 text-[15px] focus:outline-none placeholder:text-[var(--ink-400)]"
          style={{ appearance: "none" }}
        />
      </div>
    </label>
  );
}
