import { createFileRoute } from "@tanstack/react-router";

import { ClientRoster } from "@/components/clients/ClientRoster";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/inteligencia/leads")({
  component: LeadsRoster,
});

// S9-07 / #15 — Roster (Inteligência › Cadastro): TODOS os cadastros (pessoas),
// com as sub-abas Leads (todo cadastro não-cliente) e Clientes. Reusa o
// componente compartilhado ClientRoster. É a aba de CADASTRO do COMERCIAL — a
// escrita respeita comercial:edit (2026-07-19).
function LeadsRoster() {
  const canEdit = usePodeEditar("comercial");
  return (
    <ClientRoster
      eyebrow="Inteligência"
      title="Cadastro"
      breadcrumb={[{ label: "Inteligência", to: "/comercial" }, { label: "Cadastro" }]}
      showLifecycleTabs
      entityNoun="cadastro"
      entityNounPlural="cadastros"
      canEdit={canEdit}
    />
  );
}
