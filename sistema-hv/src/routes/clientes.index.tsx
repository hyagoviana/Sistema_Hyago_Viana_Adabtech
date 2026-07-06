import { createFileRoute } from "@tanstack/react-router";

import { ClientRoster } from "@/components/clients/ClientRoster";

export const Route = createFileRoute("/clientes/")({
  component: ClientesList,
});

// S9-07 — "Clientes" (Operação) mostra SÓ clientes de fato (fonte
// system_clients_clientes via lifecycle='cliente'), sem as sub-abas de lead/
// perdido. O roster completo (Todos/Leads/Clientes/Perdidos) fica em
// Inteligência › Leads (rota /inteligencia/leads).
function ClientesList() {
  return (
    <ClientRoster
      eyebrow="Operação"
      title="Clientes"
      breadcrumb={[{ label: "Operação", to: "/hoje" }, { label: "Clientes" }]}
      showLifecycleTabs={false}
      fixedLifecycle="cliente"
      entityNoun="cliente"
      entityNounPlural="clientes"
    />
  );
}
