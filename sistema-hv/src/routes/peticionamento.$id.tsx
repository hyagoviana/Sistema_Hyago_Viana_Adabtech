import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumb } from "@/components/hv/primitives";
import { StubPage } from "@/components/hv/StubPage";
import { useDocumentTitle } from "@/lib/use-document-title";
import { usePublishRouteTitle } from "@/lib/route-title";

export const Route = createFileRoute("/peticionamento/$id")({
  component: PeticionamentoEditor,
});

function PeticionamentoEditor() {
  // S4-06 — sem fonte de dados da minuta ainda (tela stub). Título/breadcrumb
  // usam rótulo genérico "Editor de Minuta", NUNCA o UUID do param.
  useDocumentTitle("Editor de Minuta");
  // fix breadcrumb Topbar (2026-07-03) — rótulo genérico p/ o Topbar (nunca UUID).
  usePublishRouteTitle("Editor de Minuta");

  return (
    <div className="page-container">
      <Breadcrumb
        items={[{ label: "Peticionamento", to: "/peticionamento" }, { label: "Editor de Minuta" }]}
      />
      <StubPage
        crumbs={[]}
        eyebrow="Peticionamento"
        title="Editor de Minuta"
        subtitle="Editor rich-text com painel de IA e mapa de fontes."
      />
    </div>
  );
}
