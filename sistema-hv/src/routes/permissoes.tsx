import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { RolePermsMatrix } from "@/components/settings/RolePermsMatrix";
import { UsersAdmin } from "@/components/settings/UsersAdmin";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/permissoes")({
  component: Permissoes,
});

type Aba = "usuarios" | "papeis";

// Aba dedicada de Usuários e Permissões (extraída de Configurações — item 5).
//
// S5-02 (reunião 02/09) — ganhou a segunda aba, "Padrão por papel". Thiago: "eu
// acho que a gente precisava de um menu de permissão do perfil, onde a gente pode
// configurar o que que o perfil em si vai ver". Antes só dava para ajustar pessoa
// por pessoa.
function Permissoes() {
  const { session, role, loading } = useAuth();
  const isAdmin = role === "admin";
  const [aba, setAba] = useState<Aba>("usuarios");

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Sistema", to: "/hoje" }, { label: "Permissões" }]} />
      <PageHeader
        eyebrow="Sistema"
        title="Usuários e permissões"
        subtitle="Convide pessoas, defina o padrão de cada papel e ajuste exceções individuais."
      />

      {loading ? null : isAdmin && session?.user?.id ? (
        <>
          <div className="mb-5 flex gap-1 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setAba("usuarios")}
              className={`px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
                aba === "usuarios"
                  ? "border-[var(--gold)] font-medium text-[var(--navy)]"
                  : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
              }`}
            >
              Pessoas
            </button>
            <button
              type="button"
              onClick={() => setAba("papeis")}
              className={`px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
                aba === "papeis"
                  ? "border-[var(--gold)] font-medium text-[var(--navy)]"
                  : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
              }`}
            >
              Padrão por papel
            </button>
          </div>

          {aba === "usuarios" ? (
            <UsersAdmin currentUserId={session.user.id} />
          ) : (
            <RolePermsMatrix />
          )}
        </>
      ) : (
        <div className="card-editorial !p-6 text-center text-[13px] text-muted-foreground">
          A gestão de usuários e permissões está restrita ao administrador.
        </div>
      )}
    </div>
  );
}
