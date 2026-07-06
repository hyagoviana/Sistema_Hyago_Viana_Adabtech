import { createFileRoute } from "@tanstack/react-router";

import { ClientRoster } from "@/components/clients/ClientRoster";

export const Route = createFileRoute("/inteligencia/leads")({
  component: LeadsRoster,
});

// S9-07 / #15 — Roster (Inteligência › Cadastro): TODOS os cadastros (pessoas),
// com as sub-abas Leads (todo cadastro não-cliente) e Clientes. Reusa o
// componente compartilhado ClientRoster; só leitura.
function LeadsRoster() {
  return (
    <ClientRoster
      eyebrow="Inteligência"
      title="Cadastro"
      breadcrumb={[{ label: "Inteligência", to: "/comercial" }, { label: "Cadastro" }]}
      showLifecycleTabs
      entityNoun="cadastro"
      entityNounPlural="cadastros"
    />
  );
}
