import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, List, Filter } from "lucide-react";
import { Breadcrumb, PageHeader, Btn, Eyebrow } from "@/components/hv/primitives";
import { CaseCard } from "@/components/hv/CaseCard";
import { casos, macroOpLabels, type MacroOp } from "@/mocks/fixtures";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/casos/")({
  component: CasosKanban,
});

const columns: { key: MacroOp; tone: string }[] = [
  { key: "ONBOARDING", tone: "neutral" },
  { key: "ANALISE", tone: "neutral" },
  { key: "CONFERENCIA", tone: "navy" },
  { key: "PRONTO_AJUIZAR", tone: "gold" },
  { key: "EM_ANDAMENTO", tone: "gold" },
  { key: "AGUARDANDO_DECISAO", tone: "warning" },
  { key: "IMPLANTADO", tone: "success" },
  { key: "IMPLANTACAO_PARCIAL", tone: "success" },
  { key: "ENCERRADO", tone: "neutral" },
  { key: "CANCELADO", tone: "danger" },
];

const toneColor: Record<string, string> = {
  neutral: "var(--muted-foreground)",
  navy: "var(--navy)",
  gold: "var(--gold-700)",
  warning: "var(--warning)",
  success: "var(--success)",
  danger: "var(--danger)",
};

function CasosKanban() {
  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Pipeline Operacional" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Operacional"
        subtitle="180 casos distribuídos em 10 estados operacionais. Arraste para mover (mock)."
        aside={
          <div className="flex items-center gap-2">
            <Link to="/casos/lista">
              <Btn variant="ghost"><List size={14} />Ver lista</Btn>
            </Link>
            <Btn variant="gold"><Plus size={14} />Novo caso</Btn>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
          <input
            placeholder="Buscar por código, cliente ou CPF…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <Btn variant="outline" size="sm"><Filter size={13} />Filtrar macrostatus</Btn>
      </div>

      <div className="overflow-x-auto -mx-2 pb-4">
        <div className="flex gap-3 px-2 min-w-max">
          {columns.map((col) => {
            const items = casos.filter((c) => c.macrostatusOp === col.key).slice(0, 8);
            return (
              <div key={col.key} className="w-[280px] shrink-0 flex flex-col">
                <div className="flex items-center justify-between px-2 py-3 border-b-2 mb-3" style={{ borderColor: toneColor[col.tone] }}>
                  <div>
                    <Eyebrow>{macroOpLabels[col.key]}</Eyebrow>
                  </div>
                  <span className="font-display text-[20px] font-semibold" style={{ color: toneColor[col.tone] }}>
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {items.map((c) => (
                    <CaseCard key={c.id} caso={c} />
                  ))}
                  {items.length === 0 && (
                    <div className="text-[12px] text-muted-foreground text-center py-8 italic">vazio</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
