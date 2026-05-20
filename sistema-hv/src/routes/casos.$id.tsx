import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Phone, Mail, FileText, Activity, DollarSign, MessageCircle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Breadcrumb, PageHeader, Btn, Eyebrow, Card, AlertStrip, OrnamentalDivider } from "@/components/hv/primitives";
import { MacrostatusOp, MacrostatusFin } from "@/components/hv/MacrostatusBadge";
import { casos, clientes, caseTypeLabels, fmtBRL, maskCPF } from "@/mocks/fixtures";

export const Route = createFileRoute("/casos/$id")({
  component: CasoDetalhe,
});

function CasoDetalhe() {
  const { id } = Route.useParams();
  const caso = casos.find((c) => c.id === id);
  if (!caso) throw notFound();
  const cliente = clientes[parseInt(caso.clienteId.split("-")[1]) % clientes.length];

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: caso.codigo }]} />

      <header className="flex items-start justify-between gap-8 mb-8">
        <div>
          <div className="mb-3"><Eyebrow>Caso · {caso.codigo}</Eyebrow></div>
          <h1 className="font-display text-[40px] font-bold text-[var(--navy)] leading-tight">
            {caso.clienteNome} <span className="text-[var(--gold-700)]">— {caseTypeLabels[caso.tipo]}</span>
          </h1>
          <div className="mt-4 flex items-center gap-5 text-[13px] text-muted-foreground">
            <span>CPF {maskCPF(caso.clienteCpf)}</span>
            <span className="text-[var(--gold)]">·</span>
            <span className="inline-flex items-center gap-1.5"><Phone size={12} />{cliente.telefone}</span>
            <span className="text-[var(--gold)]">·</span>
            <span className="inline-flex items-center gap-1.5"><Mail size={12} />{cliente.email}</span>
          </div>
        </div>
        <Card className="!p-5 w-[280px]">
          <Eyebrow>Cliente vinculado</Eyebrow>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-display font-semibold text-[var(--navy)]"
              style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}>
              {cliente.nome[0]}
            </div>
            <div>
              <div className="font-display text-[15px] text-[var(--navy)] font-semibold">{cliente.nome}</div>
              <Link to="/clientes/$id" params={{ id: cliente.id }} className="text-[12px] text-[var(--gold-700)] hover:underline">
                Ver dossiê completo →
              </Link>
            </div>
          </div>
        </Card>
      </header>

      {caso.inadimplente && (
        <div className="mb-6">
          <AlertStrip tone="danger" title="Cliente com parcelas em atraso">
            Existem 2 boletos vencidos somando R$ 4.800. Considere escalar para o jurídico de cobrança.
          </AlertStrip>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-hero p-7 relative">
          <div className="relative">
            <Eyebrow>Rastro Operacional</Eyebrow>
            <div className="mt-4 flex items-center gap-3">
              <MacrostatusOp status={caso.macrostatusOp} />
              <span className="text-[12px] text-muted-foreground">há {caso.diasNoEstado} dias neste estado</span>
            </div>
            <div className="mt-5 pt-5 border-t border-[rgba(30,32,68,0.08)]">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Próximo passo</div>
              <div className="font-display text-[18px] text-[var(--navy)]">{caso.proximoPasso}</div>
            </div>
          </div>
        </div>
        <div className="card-hero p-7 relative">
          <div className="relative">
            <Eyebrow>Rastro Financeiro</Eyebrow>
            <div className="mt-4 flex items-center gap-3">
              <MacrostatusFin status={caso.macrostatusFin} />
              <span className="text-[12px] text-muted-foreground">{fmtBRL(caso.valor)} contratado</span>
            </div>
            <div className="mt-5 pt-5 border-t border-[rgba(30,32,68,0.08)]">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Próximo passo financeiro</div>
              <div className="font-display text-[18px] text-[var(--navy)]">Confirmar pagamento da parcela #4</div>
            </div>
          </div>
        </div>
      </div>

      <OrnamentalDivider />

      <Tabs />

      <div className="h-24" />

      <footer className="fixed bottom-0 left-64 right-0 bg-white/95 backdrop-blur border-t border-[var(--border)] px-10 py-4 flex items-center justify-between z-30"
        style={{ boxShadow: "0 -8px 24px -12px rgba(30,32,68,0.15)" }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <Eyebrow>Próxima ação</Eyebrow>
            <div className="font-display text-[15px] text-[var(--navy)] font-semibold mt-1">{caso.proximoPasso}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">Responsável: <span className="text-[var(--navy)] font-medium">{caso.responsavel}</span></span>
          <Btn variant="primary">Marcar como feito</Btn>
        </div>
      </footer>
    </div>
  );
}

function Tabs() {
  const tabs = [
    { label: "Documentos", icon: FileText },
    { label: "Timeline", icon: Activity },
    { label: "Financeiro", icon: DollarSign },
    { label: "Comunicação", icon: MessageCircle },
    { label: "Auditoria", icon: ShieldCheck },
  ];
  return (
    <div className="card-editorial !p-0 overflow-hidden">
      <div className="flex border-b border-[var(--border)]">
        {tabs.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              className={`relative flex items-center gap-2 px-5 py-4 text-[13px] font-medium transition-colors ${
                i === 0 ? "text-[var(--navy)]" : "text-muted-foreground hover:text-[var(--navy)]"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {i === 0 && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[var(--gold)] rounded-full" />}
            </button>
          );
        })}
      </div>
      <div className="p-7 space-y-3">
        {["Procuração assinada","Comprovante de matrícula FIES","Histórico escolar","Parecer técnico interno","Petição inicial v3"].map((d, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--gold-pale)] text-[var(--gold-700)] flex items-center justify-center">
                <FileText size={15} />
              </div>
              <div>
                <div className="font-display text-[14.5px] text-[var(--navy)] font-semibold">{d}</div>
                <div className="text-[11.5px] text-muted-foreground">PDF · 1.2 MB · enviado há 3 dias</div>
              </div>
            </div>
            <Btn variant="ghost" size="sm">Abrir</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}
