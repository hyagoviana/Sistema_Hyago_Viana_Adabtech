// CONFIGURAÇÕES › INTEGRAÇÕES — onde moram as credenciais dos sistemas externos.
//
// Doc "21.08 _ Controladoria", na página de configuração do motor:
//   "Acho que isso da API tem que ir para um espaço de configurações geral no
//    sistema para tirar margem de erro humano."
//
// A tela do motor ficou só com o que é operação (modo, horário, média diária,
// write-back) e aponta para cá.

import { createFileRoute } from "@tanstack/react-router";
import { Plug } from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { ContaAzulCategoriasCard } from "@/components/settings/ContaAzulCategoriasCard";
import { ProjurisCredsCard } from "@/components/settings/ProjurisCredsCard";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/configuracoes/integracoes")({
  component: IntegracoesPage,
});

function IntegracoesPage() {
  // Mesmo gate do servidor (`saveDistributionCredsFn` exige controladoria:edit).
  const podeEditar = usePodeEditar("controladoria");

  return (
    <div className="page-container">
      <Breadcrumb
        items={[{ label: "Configurações", to: "/configuracoes" }, { label: "Integrações" }]}
      />
      <PageHeader
        eyebrow="Sistema"
        title="Integrações"
        subtitle="Credenciais de acesso aos sistemas externos. Ficam fora das telas de operação para reduzir o risco de alteração acidental."
      />

      {!podeEditar ? (
        <div className="card-editorial !p-6 text-center text-[13px] text-muted-foreground">
          <Plug size={18} className="mx-auto mb-2 text-muted-foreground" />
          As credenciais de integração são visíveis apenas para quem administra a controladoria.
        </div>
      ) : (
        <div className="space-y-5">
          <ProjurisCredsCard />

          <p className="text-[12px] text-muted-foreground">
            As senhas e tokens são gravados de forma que a tela nunca os lê de volta — ela só sabe
            se já existe um valor guardado. Deixar o campo em branco mantém o que está salvo.
          </p>

          {/* De-para das categorias com o ContaAzul (Thiago, 28/08). Aqui e não na
              tela do tema: o vínculo é do SISTEMA inteiro, não de um tema. */}
          <ContaAzulCategoriasCard podeEditar={podeEditar} />
        </div>
      )}
    </div>
  );
}
