// S3-01 (reunião 02/09) — EDIÇÃO DO CLIENTE em página própria.
//
// Rota `/clientes/editar/:id` e não `/clientes/:id/editar`: no TanStack, a
// segunda forma tornaria a ficha (`clientes.$id.tsx`) um layout, exigindo
// `<Outlet/>` + um `clientes.$id.index.tsx` — reforma que esta story não precisa
// fazer, e que já causou problema neste projeto antes. Rota irmã resolve igual.

import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";

import { ClientForm } from "@/components/clients/ClientForm";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useClient } from "@/hooks/useClients";
import { usePodeEditarAlgum } from "@/hooks/usePermissions";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/clientes/editar/$id")({
  component: EditarClientePage,
});

function EditarClientePage() {
  const { id } = useParams({ from: "/clientes/editar/$id" });
  const navigate = useNavigate();
  const { data: cliente, isLoading } = useClient(id);
  const podeEditar = usePodeEditarAlgum(["comercial", "operacional"]);

  useDocumentTitle(
    `${resolveEntityLabel(cliente?.full_name, { notFoundLabel: "Cliente" })} · Editar`,
  );

  const voltarParaFicha = () => navigate({ to: "/clientes/$id", params: { id } });

  // QA S3-01 — a página em si passa a ter gate de UI. Os botões que levam aqui já
  // eram gate-ados, e o servidor barra de qualquer jeito (requireAnyModule), mas
  // quem digitasse a URL veria um formulário que não conseguiria salvar.
  if (!podeEditar) {
    return (
      <div className="page-container max-w-3xl">
        <div className="card-editorial !p-8 text-center text-[13px] text-muted-foreground">
          Você não tem permissão para editar o cadastro de clientes.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-container max-w-3xl">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="page-container max-w-3xl">
        <div className="card-editorial !p-8 text-center text-[13px] text-muted-foreground">
          Cliente não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Clientes", to: "/clientes" },
          { label: cliente.full_name, to: `/clientes/${id}` },
          { label: "Editar" },
        ]}
      />
      <PageHeader eyebrow="Clientes" title={`Editar · ${cliente.full_name}`} />

      <ClientForm
        mode="edit"
        client={cliente}
        onDone={voltarParaFicha}
        onCancel={voltarParaFicha}
      />
    </div>
  );
}
