import { createFileRoute, notFound } from "@tanstack/react-router";
import { Breadcrumb, PageHeader, Eyebrow, OrnamentalDivider, Card } from "@/components/hv/primitives";
import { CaseCard } from "@/components/hv/CaseCard";
import { clientes, casos, fmtBRL, maskCPF } from "@/mocks/fixtures";

export const Route = createFileRoute("/clientes/$id")({
  component: ClienteDetalhe,
});

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) throw notFound();
  const casosCliente = casos.filter((c) => c.clienteId === id).slice(0, 6);

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Clientes", to: "/clientes" }, { label: cliente.nome }]} />

      <header className="flex items-end gap-6 mb-8">
        <div className="w-24 h-24 rounded-full flex items-center justify-center font-display text-[40px] font-bold text-[var(--navy)]"
          style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}>
          {cliente.nome[0]}
        </div>
        <div className="flex-1">
          <Eyebrow>Cliente · CPF {maskCPF(cliente.cpf)}</Eyebrow>
          <h1 className="font-display text-[40px] font-bold text-[var(--navy)] mt-2 h1-ornament">
            {cliente.nome}
          </h1>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Total de casos" value={cliente.totalCasos} />
        <Stat label="Receita total" value={fmtBRL(cliente.receita)} />
        <Stat label="LTV estimado" value={fmtBRL(cliente.ltv)} />
      </div>

      <OrnamentalDivider />

      <h2 className="font-display text-[24px] font-semibold text-[var(--navy)] mb-5">Casos vinculados</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {casosCliente.map((c) => <CaseCard key={c.id} caso={c} compact={false} />)}
        {casosCliente.length === 0 && (
          <div className="text-muted-foreground italic col-span-full text-center py-12">
            Sem casos vinculados.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <div className="kpi-number text-[36px] mt-3">{value}</div>
    </Card>
  );
}
