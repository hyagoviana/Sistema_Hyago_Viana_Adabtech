import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow } from "@/components/hv/primitives";
import logoHV from "@/assets/logo-hv.png";

export const Route = createFileRoute("/entrar")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="relative hidden lg:flex flex-col justify-between p-14 text-white overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(212,168,50,0.18), transparent 55%), linear-gradient(180deg, #11132a, #0b0c1d)",
        }}
      >
        <div className="absolute inset-0 opacity-[0.06] paper-texture pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}
          >
            <img src={logoHV} alt="HV" className="w-8 h-8 object-contain mix-blend-luminosity opacity-90" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold">Hyago Viana</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#d4a832]">Advocacia</div>
          </div>
        </div>

        <blockquote className="relative max-w-lg">
          <div className="text-[#d4a832] text-2xl mb-4">✦</div>
          <p className="font-display italic text-[34px] leading-[1.2] text-white/95">
            A excelência jurídica começa pela disciplina dos detalhes.
          </p>
          <footer className="mt-6 text-sm tracking-[0.18em] uppercase text-[rgba(212,168,50,0.85)]">
            — Hyago Viana, OAB/AL
          </footer>
        </blockquote>

        <div className="relative text-xs text-white/40 tracking-wider">
          © 2026 Hyago Viana Advocacia
        </div>
      </div>

      <div className="flex items-center justify-center p-8 lg:p-16 bg-white">
        <form className="w-full max-w-md" onSubmit={(e) => e.preventDefault()}>
          <Eyebrow>Acesso restrito</Eyebrow>
          <h1 className="font-display text-[42px] font-bold text-[var(--navy)] mt-4 mb-2">
            Bem-vindo de volta
          </h1>
          <p className="text-muted-foreground mb-10">
            Entre com suas credenciais para acessar o sistema.
          </p>

          <div className="space-y-5">
            <Field label="E-mail" type="email" placeholder="seu@email.com" />
            <Field label="Senha" type="password" placeholder="••••••••" />
          </div>

          <Link
            to="/hoje"
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 rounded-md bg-[var(--navy)] text-white font-medium hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[rgba(30,32,68,0.25)] transition-all"
          >
            Entrar no sistema
          </Link>

          <div className="mt-6 text-center">
            <a href="#" className="text-sm text-[var(--gold-700)] hover:text-[var(--gold)] font-medium">
              Esqueci minha senha
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type, placeholder }: { label: string; type: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--gold-700)] mb-2">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-[var(--border)] rounded-md focus:border-[var(--gold)] focus:outline-none transition-colors text-[15px]"
      />
    </label>
  );
}
