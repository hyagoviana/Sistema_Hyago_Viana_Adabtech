import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Mail } from "lucide-react";
import logoHV from "@/assets/logo-hv.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-10 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 20% 10%, rgba(152,120,20,0.16), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(30,32,68,0.55), transparent 60%), #000000",
      }}
    >
      {/* Subtle gold grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(232,232,232,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(232,232,232,0.4) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative w-full max-w-[440px]">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{
              background: "linear-gradient(135deg, #1e2044 0%, #0b0c1d 100%)",
              boxShadow:
                "0 0 0 1px rgba(152,120,20,0.35), 0 20px 60px -20px rgba(152,120,20,0.45)",
            }}
          >
            <img src={logoHV} alt="HV" className="w-9 h-9 object-contain" />
          </div>
          <h1
            className="text-[26px] font-semibold tracking-tight text-white text-center"
            style={{ letterSpacing: "-0.02em" }}
          >
            Hyago Viana{" "}
            <span style={{ color: "#987814" }}>Advocacia</span>
          </h1>
          <div
            className="mt-2 flex items-center gap-3 text-[10.5px] uppercase font-medium"
            style={{ color: "#987814", letterSpacing: "0.32em" }}
          >
            <span className="h-px w-8" style={{ background: "rgba(152,120,20,0.5)" }} />
            Acesso Restrito
            <span className="h-px w-8" style={{ background: "rgba(152,120,20,0.5)" }} />
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 backdrop-blur-xl"
          style={{
            background: "rgba(15, 17, 35, 0.55)",
            border: "1px solid rgba(232,232,232,0.08)",
            boxShadow:
              "0 30px 80px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="mb-6">
            <h2 className="text-white text-[18px] font-medium tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "rgba(232,232,232,0.55)" }}>
              Entre com suas credenciais corporativas.
            </p>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            <DarkField
              label="E-mail"
              type="email"
              placeholder="seu@hyagoviana.adv.br"
              icon={<Mail size={15} />}
            />
            <DarkField
              label="Senha"
              type="password"
              placeholder="••••••••••"
              icon={<Lock size={15} />}
              trailing={
                <a
                  href="#"
                  className="text-[11px] font-medium"
                  style={{ color: "#987814" }}
                >
                  Esqueci
                </a>
              }
            />

            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded-sm accent-[#987814]"
                style={{ accentColor: "#987814" }}
              />
              <span className="text-[12px]" style={{ color: "rgba(232,232,232,0.65)" }}>
                Manter sessão ativa neste dispositivo
              </span>
            </label>

            <Link
              to="/hoje"
              className="mt-2 w-full inline-flex items-center justify-center px-5 py-3 rounded-lg text-[14px] font-medium text-white transition-all hover:-translate-y-[1px]"
              style={{
                background: "#1e2044",
                border: "1px solid rgba(152,120,20,0.5)",
                boxShadow:
                  "0 10px 30px -10px rgba(152,120,20,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              Entrar no sistema
            </Link>
          </form>

          <div
            className="mt-6 pt-5 text-center text-[11.5px]"
            style={{
              borderTop: "1px solid rgba(232,232,232,0.06)",
              color: "rgba(232,232,232,0.4)",
            }}
          >
            Protegido por autenticação multifator e auditoria de acesso.
          </div>
        </div>

        <div
          className="mt-8 text-center text-[10.5px] uppercase"
          style={{ color: "rgba(232,232,232,0.3)", letterSpacing: "0.25em" }}
        >
          © 2026 Hyago Viana Advocacia · OAB/AL
        </div>
      </div>
    </div>
  );
}

function DarkField({
  label,
  type,
  placeholder,
  icon,
  trailing,
}: {
  label: string;
  type: string;
  placeholder: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[10.5px] font-semibold uppercase"
          style={{ color: "#987814", letterSpacing: "0.18em" }}
        >
          {label}
        </span>
        {trailing}
      </div>
      <div
        className="flex items-center gap-2.5 px-3.5 rounded-lg transition-colors focus-within:border-[rgba(152,120,20,0.6)]"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(232,232,232,0.1)",
        }}
      >
        {icon && <span style={{ color: "rgba(232,232,232,0.4)" }}>{icon}</span>}
        <input
          type={type}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 text-[14px] text-white placeholder:text-[rgba(232,232,232,0.3)] focus:outline-none"
        />
      </div>
    </label>
  );
}
