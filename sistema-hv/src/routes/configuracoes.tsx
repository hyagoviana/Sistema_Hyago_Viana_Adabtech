import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { UsersAdmin } from "@/components/settings/UsersAdmin";
import { useAuth } from "@/lib/auth";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/rbac";

export const Route = createFileRoute("/configuracoes")({
  component: Configuracoes,
});

function Configuracoes() {
  const { session, profile, role, loading } = useAuth();
  const email = session?.user?.email ?? "—";
  const isAdmin = role === "admin";

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Sistema", to: "/hoje" }, { label: "Configurações" }]} />
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        subtitle="Seu perfil, usuários e permissões de acesso."
      />

      {/* Perfil do usuário logado */}
      <section className="card-editorial !p-5 mb-5">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-display text-[18px] font-semibold text-[var(--navy)] shrink-0"
            style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
          >
            {(profile?.full_name?.[0] ?? email[0] ?? "?").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[16px] font-semibold text-[var(--navy)]">
              {profile?.full_name || email.split("@")[0]}
            </div>
            <div className="text-[12.5px] text-muted-foreground">{email}</div>
          </div>
          {role && (
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--gold-700)]">
                <ShieldCheck size={14} />
                {ROLE_LABELS[role]}
              </div>
              <div className="text-[11px] text-muted-foreground max-w-[260px] mt-0.5">
                {ROLE_DESCRIPTIONS[role]}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Gestão de usuários — só admin */}
      {loading ? null : isAdmin && session?.user?.id ? (
        <UsersAdmin currentUserId={session.user.id} />
      ) : (
        <div className="card-editorial !p-6 text-center text-[13px] text-muted-foreground">
          A gestão de usuários e permissões está restrita ao administrador.
        </div>
      )}
    </div>
  );
}
