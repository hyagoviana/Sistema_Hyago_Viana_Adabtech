import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet } from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { ImportHistoryTable } from "@/components/import/ImportHistoryTable";
import { ImportStepper } from "@/components/import/ImportStepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/configuracoes/importacao")({
  component: ImportacaoPage,
});

function ImportacaoPage() {
  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Sistema", to: "/hoje" },
          { label: "Configuracoes", to: "/configuracoes" },
          { label: "Importar dados" },
        ]}
      />
      <PageHeader
        eyebrow="Sistema"
        title="Importar dados"
        subtitle="Importe clientes e casos a partir de planilhas de sistemas externos (SAJ, PJe, Projuris, etc.)."
      />

      <Tabs defaultValue="nova" className="mt-6">
        <TabsList>
          <TabsTrigger value="nova" className="gap-1.5">
            <FileSpreadsheet size={14} />
            Nova importacao
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            Historico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nova" className="mt-5">
          <ImportStepper />
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <div className="card-editorial !p-5">
            <ImportHistoryTable />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
