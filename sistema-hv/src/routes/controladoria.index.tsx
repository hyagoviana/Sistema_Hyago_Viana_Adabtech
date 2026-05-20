import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card, SectionHeader, Btn, StatusDot } from "@/components/hv/primitives";
import { casos } from "@/mocks/fixtures";

export const Route = createFileRoute("/controladoria/")({
  component: ControladoriaPage,
});

const prazos = casos.slice(0, 8).map((c, i) => ({
  id: c.id,
  caso: c.codigo,
  tese: ["FIES revisão", "Mandado segurança CFM", "Recurso MEC", "Embargos"][i % 4],
  prazoData: new Date(Date.now() + (i + 1) * 86400000 * (i < 3 ? 1 : 3)),
  diasRestantes: i + 1 + (i < 3 ? 0 : 5),
  responsavel: c.responsavel,
  status: ["Em curso", "Aguardando", "Em revisão"][i % 3],
  fonte: ["PJe", "PROJUDI", "STF"][i % 3],
}));

function slaTone(d: number): "danger" | "warning" | "success" {
  if (d <= 2) return "danger";
  if (d <= 5) return "warning";
  return "success";
}

function ControladoriaPage() {
  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Inteligência"
        title="Controladoria Jurídica"
        subtitle="Prazos, exceções, teses e decisões."
      />

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div>
          <SectionHeader title="Prazos críticos" count={prazos.length} />
          <Card className="!p-0 overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Tese</th>
                  <th>Prazo</th>
                  <th>Restam</th>
                  <th>Resp.</th>
                  <th>Status</th>
                  <th>Fonte</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {prazos.map((p) => {
                  const tone = slaTone(p.diasRestantes);
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-[12px]">{p.caso}</td>
                      <td className="font-medium text-[var(--navy)]">{p.tese}</td>
                      <td className="tabular text-[#525252]">
                        {p.prazoData.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 tabular font-semibold"
                          style={{ color: `var(--${tone})` }}>
                          <StatusDot tone={tone} />
                          {p.diasRestantes}d
                        </span>
                      </td>
                      <td className="text-[#525252]">{p.responsavel}</td>
                      <td className="text-[#525252]">{p.status}</td>
                      <td className="text-[#525252] font-mono text-[12px]">{p.fonte}</td>
                      <td>
                        <Btn variant="outline" size="sm">Abrir</Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <SectionHeader title="Resumo" />
          <Card className="!p-4 space-y-3">
            {[
              { label: "Teses ativas", value: "42" },
              { label: "Decisões no mês", value: "18" },
              { label: "Exceções abertas", value: "06" },
              { label: "Taxa cumprimento", value: "94%" },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline justify-between pb-3" style={{ borderBottom: "1px solid #f5f5f5" }}>
                <div className="text-[12px] text-[#525252]">{s.label}</div>
                <div className="kpi-number text-[20px]">{s.value}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
