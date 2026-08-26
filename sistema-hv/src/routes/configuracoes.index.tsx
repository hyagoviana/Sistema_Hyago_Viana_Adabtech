import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileSpreadsheet,
  ListChecks,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Zap,
} from "lucide-react";

import { Breadcrumb, Eyebrow, PageHeader } from "@/components/hv/primitives";
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

      {/* N1 — Thiago: "eu tenho as configurações do meu usuário, mas eu tenho
          também as do sistema — separar como menu". São duas seções rotuladas;
          as rotas filhas continuam nas MESMAS URLs. */}
      <Eyebrow>Meu perfil</Eyebrow>
      <p className="text-[12px] text-muted-foreground mb-3">
        Seus dados, sua senha e a aparência do sistema para você.
      </p>

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

      {/* ---------------------------------------------------------------- */}
      {/* Configurações DO SISTEMA — só para quem administra (gate inalterado). */}
      {podeGerirCampos && (
        <div className="mt-8 mb-3">
          <Eyebrow>Sistema</Eyebrow>
          <p className="text-[12px] text-muted-foreground">
            Configurações que valem para todo o escritório — visíveis apenas para quem administra.
          </p>
        </div>
      )}

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

      {/* Importar dados — mesmo guard de campos personalizados */}
      {podeGerirCampos && (
        <Link
          to="/configuracoes/importacao"
          className="card-editorial !p-5 mt-5 flex items-center gap-3 hover:border-[var(--gold)] transition-colors"
        >
          <FileSpreadsheet size={18} className="text-[var(--gold-700)]" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--navy)]">Importar dados</div>
            <div className="text-[12px] text-muted-foreground">
              Importe clientes e casos a partir de planilhas (CSV/XLSX) de sistemas externos.
            </div>
          </div>
          <span className="text-[var(--gold-700)] text-sm">Abrir →</span>
        </Link>
      )}

      {/* Integrações — credenciais de sistemas externos (doc 21.08: tirar a API
          das telas de operação). Mesmo gate do servidor: controladoria:edit. */}
      {podeGerirCampos && (
        <Link
          to="/configuracoes/integracoes"
          className="card-editorial !p-5 mt-5 flex items-center gap-3 hover:border-[var(--gold)] transition-colors"
        >
          <Plug size={18} className="text-[var(--gold-700)]" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--navy)]">Integrações</div>
            <div className="text-[12px] text-muted-foreground">
              Credenciais de acesso ao ProJuris e demais sistemas externos.
            </div>
          </div>
          <span className="text-[var(--gold-700)] text-sm">Abrir →</span>
        </Link>
      )}

      {/* Cadastros gerais → Tipos de tarefa (doc 21.08): o tipo de tarefa saiu de
          dentro do motor e virou configuração do sistema. */}
      {podeGerirCampos && (
        <Link
          to="/configuracoes/tipos-tarefa"
          className="card-editorial !p-5 mt-5 flex items-center gap-3 hover:border-[var(--gold)] transition-colors"
        >
          <ListChecks size={18} className="text-[var(--gold-700)]" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--navy)]">Tipos de tarefa</div>
            <div className="text-[12px] text-muted-foreground">
              Catálogo único do sistema: classe, pontuação, prazos, responsável exclusivo e o que
              entra no motor de distribuição.
            </div>
          </div>
          <span className="text-[var(--gold-700)] text-sm">Abrir →</span>
        </Link>
      )}

      {/* #2 — atalho para Workflows (automações) — mesmo guard de sistema:edit */}
      {podeGerirCampos && (
        <Link
          to="/configuracoes/workflows"
          className="card-editorial !p-5 mt-5 flex items-center gap-3 hover:border-[var(--gold)] transition-colors"
        >
          <Zap size={18} className="text-[var(--gold-700)]" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--navy)]">Workflows</div>
            <div className="text-[12px] text-muted-foreground">
              Automatize ações do caso: ao mudar de etapa, crie tarefas e registre comentários.
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
