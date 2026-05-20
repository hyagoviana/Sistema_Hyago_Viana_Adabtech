import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, ChevronRight, Phone } from "lucide-react";
import { Breadcrumb, PageHeader, Btn, Eyebrow, Badge } from "@/components/hv/primitives";
import { clientes, fmtBRL } from "@/mocks/fixtures";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/clientes/")({
  component: ClientesList,
});

function ClientesList() {
  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Clientes" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Clientes"
        subtitle="80 cadastrados · 62 ativos · 12 novos no mês"
        aside={
          <div className="flex gap-2">
            <Btn variant="outline">Importar Excel</Btn>
            <Btn variant="gold"><Plus size={14} />Novo cliente</Btn>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
          <input
            placeholder="Buscar por nome, CPF ou município…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <select className="px-4 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px]">
          <option>Todos os tipos</option><option>Médico</option><option>Dentista</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {clientes.slice(0, 24).map((c) => (
          <Link key={c.id} to="/clientes/$id" params={{ id: c.id }}
            className="card-editorial !p-5 flex items-center gap-4 group">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-[18px] font-semibold text-[var(--navy)] shrink-0"
              style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}>
              {c.nome[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-[16px] font-semibold text-[var(--navy)] group-hover:text-[var(--gold-700)] transition-colors">
                {c.nome}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge tone="navy">{c.tipo}</Badge>
                <span className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1.5">
                  <Phone size={10} /> {c.telefone}
                </span>
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-1.5">
                {c.municipio} · <span className="text-[var(--navy)] font-medium">{c.totalCasos} casos</span> · {fmtBRL(c.receita)}
              </div>
            </div>
            <ChevronRight size={18} className="text-[var(--gold)] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  );
}
