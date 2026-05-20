import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Breadcrumb, PageHeader, Btn, Eyebrow } from "@/components/hv/primitives";
import { MacrostatusFin, MacrostatusOp } from "@/components/hv/MacrostatusBadge";
import { casos, caseTypeLabels, fmtBRL } from "@/mocks/fixtures";

export const Route = createFileRoute("/casos/lista")({
  component: CasosLista,
});

function CasosLista() {
  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Casos", to: "/casos" }, { label: "Lista" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Lista de casos"
        subtitle="Visão tabular com 180 casos. Editorial premium para análise rápida."
        aside={
          <Link to="/casos">
            <Btn variant="outline"><ArrowLeft size={14} />Voltar ao Kanban</Btn>
          </Link>
        }
      />

      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--gold-pale)]/40 border-b border-[var(--border)]">
                {["Código","Cliente","Tipo","Operacional","Financeiro","Município","Valor"].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5">
                    <Eyebrow>{h}</Eyebrow>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {casos.slice(0, 50).map((c) => (
                <tr key={c.id} className="border-b border-[rgba(152,120,20,0.08)] hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">
                    <Link to="/casos/$id" params={{ id: c.id }} className="hover:text-[var(--gold-700)]">
                      {c.codigo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-display font-semibold text-[var(--navy)]"
                        style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}>
                        {c.clienteNome[0]}
                      </div>
                      <span className="text-[var(--navy)] font-medium">{c.clienteNome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-[12px] text-muted-foreground">{caseTypeLabels[c.tipo]}</span></td>
                  <td className="px-4 py-3"><MacrostatusOp status={c.macrostatusOp} /></td>
                  <td className="px-4 py-3"><MacrostatusFin status={c.macrostatusFin} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.municipio}</td>
                  <td className="px-4 py-3 font-mono text-[var(--navy)]">{fmtBRL(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Mostrando 50 de 180 casos</span>
          <div className="flex gap-2">
            <Btn variant="ghost" size="sm">Anterior</Btn>
            <Btn variant="outline" size="sm">Próximo</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
