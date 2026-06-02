import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";

export const Route = createFileRoute("/controladoria/")({
  component: ControladoriaPage,
});

function ControladoriaPage() {
  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Inteligência", to: "/hoje" }, { label: "Controladoria" }]} />
      <PageHeader
        eyebrow="Inteligência"
        title="Controladoria Jurídica"
        subtitle="Prazos, exceções, teses e decisões."
      />
      <div className="card-editorial !p-10 text-center">
        <div className="text-[14px] font-medium text-[var(--navy)] mb-1">
          Nenhum dado de controladoria conectado ainda
        </div>
        <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
          Esta seção será ligada às fontes reais (prazos processuais, teses e decisões) na frente de
          Controladoria. Até lá, não exibimos indicadores fictícios.
        </p>
      </div>
    </div>
  );
}
