// S3-01 (reunião 02/09) — CADASTRO DE CLIENTE em página própria.
//
// Thiago (desenho 29): "Vamos transformar o menu 'novo cliente / Editar cliente'
// em uma página própria, mais visual e mais intuitiva, deixando de ser apenas um
// menu 'pop up'."
//
// Decisão do owner (D7): vale para TODOS os pontos de entrada — o pop-up deixou
// de existir.

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ClientForm } from "@/components/clients/ClientForm";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { usePodeEditarAlgum } from "@/hooks/usePermissions";
import { useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/clientes/novo")({
  component: NovoClientePage,
});

function NovoClientePage() {
  useDocumentTitle("Novo cliente");
  const navigate = useNavigate();
  const podeEditar = usePodeEditarAlgum(["comercial", "operacional"]);

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

  return (
    <div className="page-container max-w-3xl">
      <Breadcrumb items={[{ label: "Clientes", to: "/clientes" }, { label: "Novo cliente" }]} />
      <PageHeader
        eyebrow="Clientes"
        title="Novo cliente"
        subtitle="Preencha o cadastro. A pasta no Google Drive é criada automaticamente ao salvar."
      />

      <ClientForm
        mode="create"
        onDone={(clientId) =>
          // Salvou: vai direto para a ficha do cliente criado (ou para a lista, se
          // o id não veio — caso do CPF já existente, que reaproveita o cadastro).
          clientId
            ? navigate({ to: "/clientes/$id", params: { id: clientId } })
            : navigate({ to: "/clientes" })
        }
        onCancel={() => navigate({ to: "/clientes" })}
      />
    </div>
  );
}
