import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/hv/StubPage";

export const Route = createFileRoute("/casos/financeiro")({
  component: () => (
    <StubPage
      crumbs={[{ label: "Casos", to: "/casos" }, { label: "Financeiro" }]}
      eyebrow="Operação"
      title="Pipeline Financeira"
      subtitle="Casos por estado financeiro · 14 colunas. Drawer lateral com mini-views de exceção."
    />
  ),
});
