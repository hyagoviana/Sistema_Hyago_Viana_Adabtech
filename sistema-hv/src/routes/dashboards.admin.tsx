import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";

export const Route = createFileRoute("/dashboards/admin")({
  component: AdminDash,
});

function AdminDash() {
  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Dashboards", to: "/dashboards" }, { label: "Admin" }]} />
      <PageHeader
        eyebrow="Visão executiva"
        title="Dashboard Admin"
        subtitle="Painel consolidado do escritório."
      />
      <div className="card-editorial !p-10 text-center">
        <div className="text-[14px] font-medium text-[var(--navy)] mb-1">
          Indicadores ainda não conectados
        </div>
        <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
          Os gráficos e KPIs consolidados serão exibidos quando ligados aos dados reais (casos,
          financeiro e comercial) na frente de Dashboards. Não mostramos números fictícios.
        </p>
      </div>
    </div>
  );
}
