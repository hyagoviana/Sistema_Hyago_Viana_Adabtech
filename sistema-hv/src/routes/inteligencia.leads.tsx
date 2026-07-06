import { createFileRoute } from "@tanstack/react-router";

import { ClientRoster } from "@/components/clients/ClientRoster";

export const Route = createFileRoute("/inteligencia/leads")({
  component: LeadsRoster,
});

// S9-07 — Roster completo (Inteligência › Leads): apanhado geral de TODOS os
// cadastros (pessoas), com as 4 sub-abas Todos/Leads/Clientes/Perdidos. Reusa o
// componente compartilhado ClientRoster; nenhuma escrita nova (só leitura das
// views system_clients_*).
function LeadsRoster() {
  return (
    <ClientRoster
      eyebrow="Inteligência"
      title="Leads"
      breadcrumb={[{ label: "Inteligência", to: "/comercial" }, { label: "Leads" }]}
      showLifecycleTabs
      entityNoun="cadastro"
      entityNounPlural="cadastros"
    />
  );
}
