import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, SlidersHorizontal, Users } from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { ChangePasswordSection } from "@/components/settings/ChangePasswordSection";
import { MyProfileSection } from "@/components/settings/MyProfileSection";
import { usePodeEditar } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/rbac";

export const Route = createFileRoute("/configuracoes/")({
  component: Configuracoes,
});

function Configuracoes() {
  const { session, profile, role } = useAuth();
  const email = session?.user?.email ?? "·";
  const isAdmin = role === "admin";
  // I1/B3 — atalho de "Campos personalizados" só para quem pode editar o módulo
  // sistema (mesma régua do servidor requireModule('sistema','edit')).
  const podeGerirCampos = usePodeEditar("sistema");

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
            className="w-12 h-12 rounded-full flex items-center justify-center text-[18px] font-semibold text-[var(--navy)] shrink-0"
            style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
          >
            {(profile?.full_name?.[0] ?? email[0] ?? "?").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[var(--navy)]">
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

      {/* Meus dados — nome e telefone (o próprio usuário edita) */}
      <MyProfileSection />

      {/* Alterar senha */}
      <ChangePasswordSection />

      {/* Aparência — cores e fonte */}
      <AppearanceSettings />

      {/* I1 — atalho para a tela dedicada de Campos personalizados (só quem edita
          o módulo sistema). Reúne os campos das pipelines/temas + cadastro do cliente. */}
      {podeGerirCampos && (
        <Link
          to="/configuracoes/campos-personalizados"
          className="card-editorial !p-5 mt-5 flex items-center gap-3 hover:border-[var(--gold)] transition-colors"
        >
          <SlidersHorizontal size={18} className="text-[var(--gold-700)]" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--navy)]">
              Campos personalizados
            </div>
            <div className="text-[12px] text-muted-foreground">
              Crie e organize os campos de cada pipeline/tema e do cadastro do cliente.
            </div>
          </div>
          <span className="text-[var(--gold-700)] text-sm">Abrir →</span>
        </Link>
      )}

      {/* Atalho para a aba dedicada de Permissões (só admin) */}
      {isAdmin && (
        <Link
          to="/permissoes"
          className="card-editorial !p-5 mt-5 flex items-center gap-3 hover:border-[var(--gold)] transition-colors"
        >
          <Users size={18} className="text-[var(--gold-700)]" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--navy)]">
              Usuários e permissões
            </div>
            <div className="text-[12px] text-muted-foreground">
              Convites, papéis e acesso · agora em uma aba própria.
            </div>
          </div>
          <span className="text-[var(--gold-700)] text-sm">Abrir →</span>
        </Link>
      )}
    </div>
  );
}
