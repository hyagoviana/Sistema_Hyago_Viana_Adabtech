// AUDITORIA (AU1 — reunião 2026-08-26).
//
// O owner escolheu MENU GLOBAL: "tudo precisa ter para pesquisa, até no caso e
// no motor também". A mesma tabela é reusada no painel da ficha do caso.
//
// A trilha em si já existia (system_case_events) — o que faltava era onde olhar.

import { createFileRoute } from "@tanstack/react-router";

import { AuditTable } from "@/components/cases/AuditTable";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/auditoria")({
  component: AuditoriaPage,
});

function AuditoriaPage() {
  useDocumentTitle("Auditoria");

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Sistema", to: "/hoje" }, { label: "Auditoria" }]} />
      <PageHeader
        eyebrow="Sistema"
        title="Auditoria"
        subtitle="Quem mexeu no quê, quando e como. Inclui as alterações de campo do caso, que saíram da linha do tempo."
      />
      <AuditTable />
    </div>
  );
}
