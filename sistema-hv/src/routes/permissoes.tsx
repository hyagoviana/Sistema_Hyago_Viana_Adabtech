import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { UsersAdmin } from "@/components/settings/UsersAdmin";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/permissoes")({
  component: Permissoes,
});

// Aba dedicada de Usuários e Permissões (extraída de Configurações — item 5).
function Permissoes() {
  const { session, role, loading } = useAuth();
  const isAdmin = role === "admin";

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Sistema", to: "/hoje" }, { label: "Permissões" }]} />
      <PageHeader
        eyebrow="Sistema"
        title="Usuários e permissões"
        subtitle="Convide pessoas, defina papéis e gerencie o acesso ao sistema."
      />

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
