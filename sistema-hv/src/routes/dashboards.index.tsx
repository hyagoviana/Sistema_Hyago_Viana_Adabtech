import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, DollarSign, TrendingUp, Megaphone, MessageCircle, Crown, ChevronRight } from "lucide-react";
import { PageHeader, Eyebrow, Breadcrumb } from "@/components/hv/primitives";

export const Route = createFileRoute("/dashboards/")({
  component: DashboardsHub,
});

const dashes = [
  { to: "/dashboards/admin", label: "Admin Consolidado", icon: Crown, desc: "Visão executiva 360º · receita, op, fin, comercial." },
  { to: "/dashboards/operacional", label: "Operacional", icon: Briefcase, desc: "Tempos médios, gargalos, fluxo de casos." },
  { to: "/dashboards/financeiro", label: "Financeiro", icon: DollarSign, desc: "Recebimentos, inadimplência, projeções." },
  { to: "/dashboards/comercial", label: "Comercial", icon: TrendingUp, desc: "Funil, conversão, LTV, CAC." },
  { to: "/dashboards/marketing", label: "Marketing", icon: Megaphone, desc: "Conteúdos, alcance, leads gerados." },
  { to: "/dashboards/whatsapp", label: "WhatsApp", icon: MessageCircle, desc: "Volume, classificação IA, SLA." },
];

function DashboardsHub() {
  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Inteligência" }, { label: "Dashboards" }]} />
      <PageHeader
        eyebrow="Inteligência"
        title="Hub de Dashboards"
        subtitle="Seis lentes editoriais para enxergar o escritório em tempo real."
      />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {dashes.map((d) => {
          const Icon = d.icon;
          return (
            <Link key={d.to} to={d.to as any} className="card-hero p-7 group block">
              <div className="relative">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white mb-5"
                  style={{ background: "linear-gradient(135deg, #d4a832, #987814)", boxShadow: "0 12px 28px -8px rgba(152,120,20,0.45)" }}>
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <Eyebrow>Dashboard</Eyebrow>
                <h3 className="font-display text-[24px] font-semibold text-[var(--navy)] mt-2">{d.label}</h3>
                <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">{d.desc}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--gold-700)] group-hover:gap-2.5 transition-all">
                  Ver dashboard <ChevronRight size={14} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
