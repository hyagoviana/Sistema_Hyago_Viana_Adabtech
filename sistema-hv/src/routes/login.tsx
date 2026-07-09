import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, Mail } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { Eyebrow } from "@/components/hv/primitives";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import symbolHV from "@/assets/symbol-hv.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepSessionRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    const sb = getSupabaseBrowserClient();

    const { error: authError } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError("E-mail ou senha inválidos.");
      return;
    }

    // Se o checkbox NÃO estiver marcado, a sessão será encerrada ao fechar o navegador
    if (!keepSessionRef.current?.checked) {
      // Supabase persiste no localStorage por padrão; usar sessionStorage-like behavior
      // removendo o refresh token ao fechar — não há API direta, mas podemos
      // registrar um listener para limpar na saída
      window.addEventListener("beforeunload", () => {
        void sb.auth.signOut();
      }, { once: true });
    }

    navigate({ to: "/hoje" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Painel de marca (esquerda) — só cor, sem texturas nem grid */}
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
            <div className="font-brand text-[19px] tracking-tight">Hyago Viana</div>
            <div
              className="text-[10px] uppercase tracking-[0.28em]"
              style={{ color: "var(--hv-gold-soft)" }}
            >
              Advocacia
            </div>
          </div>
        </div>

        <blockquote className="relative max-w-lg">
          <div className="text-2xl mb-5" style={{ color: "#c9a634" }}>
            ✦
          </div>
          <p className="font-brand text-[29px] leading-[1.28] text-white/95">
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

      {/* Formulário (direita) — fundo creme→branco (handoff v3) */}
      <div
        className="flex items-center justify-center p-8 lg:p-16"
        style={{ background: "var(--hv-bg-login-form)" }}
      >
        <form onSubmit={handleSubmit} className="w-full max-w-md">
          {/* Logo no topo — visível no mobile, onde o painel esquerdo some */}
          <img
            src={symbolHV}
            alt="Hyago Viana Advocacia"
            className="h-10 w-auto object-contain mb-8 lg:hidden"
          />

          <Eyebrow>Acesso restrito</Eyebrow>
          <h1 className="font-display text-[34px] font-semibold text-[var(--navy)] mt-4 mb-2 leading-tight">
            Bem-vindo de volta
          </h1>
          <p className="text-muted-foreground mb-10">
            Entre com suas credenciais corporativas para acessar o sistema.
          </p>

          <div className="space-y-5">
            <Field
              label="E-mail"
              name="email"
              type="email"
              placeholder="seu@hyagoviana.adv.br"
              icon={<Mail size={16} />}
            />
            <Field
              label="Senha"
              name="password"
              type="password"
              placeholder="••••••••"
              icon={<Lock size={16} />}
            />
          </div>

          <label className="mt-5 flex items-center gap-2 select-none cursor-pointer">
            <input
              ref={keepSessionRef}
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded-sm"
              style={{ accentColor: "#987814" }}
            />
            <span className="text-[13px] text-muted-foreground">
              Manter sessão ativa neste dispositivo
            </span>
          </label>

          {error && (
            <p className="mt-5 text-sm" role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3.5 text-white font-semibold transition-all hover:-translate-y-0.5 active:scale-[.99] disabled:opacity-60"
            style={{
              background: "var(--hv-gold-grad)",
              borderRadius: "var(--hv-r-md)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(0,0,0,0.15), 0 8px 20px -6px rgba(138,103,42,0.5)",
            }}
          >
            {loading ? "Entrando…" : "Entrar no sistema"}
          </button>

          <div className="mt-6 text-center">
            <Link
              to="/recuperar-senha"
              className="text-sm font-medium text-[var(--gold-700)] hover:text-[var(--gold)]"
            >
              Esqueci minha senha
            </Link>
          </div>

          <p className="mt-10 text-center text-[11.5px] text-muted-foreground/70">
            Protegido por autenticação multifator e auditoria de acesso.
          </p>
        </form>
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
