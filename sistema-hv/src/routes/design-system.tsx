import { createFileRoute } from "@tanstack/react-router";
import { Heart, Star, Bell, ChevronRight, Plus, Download } from "lucide-react";
import { Breadcrumb, PageHeader, OrnamentalDivider, Card, CardHero, Eyebrow, HeroStatCard, StatCard, Btn, Badge, AlertStrip, SectionHeader } from "@/components/hv/primitives";
import { CaseCard } from "@/components/hv/CaseCard";
import { MacrostatusFin, MacrostatusOp } from "@/components/hv/MacrostatusBadge";
import type { CaseType } from "@/mocks/fixtures";

// Amostras fixas só para o showcase de componentes (não são dados do sistema).
const sampleCases: {
  id: string;
  codigo: string;
  clienteNome: string;
  tipo: CaseType;
  diasNoEstado: number;
  valor: number;
  inadimplente?: boolean;
  proximoPasso?: string;
}[] = [
  { id: "demo-1", codigo: "HV-FIES-2026-0001", clienteNome: "Cliente de Exemplo A", tipo: "FIES_ESF", diasNoEstado: 8, valor: 12000, proximoPasso: "Conferência documental" },
  { id: "demo-2", codigo: "HV-MM-2026-0002", clienteNome: "Cliente de Exemplo B", tipo: "MAIS_MEDICOS", diasNoEstado: 22, valor: 9800, proximoPasso: "Protocolar petição" },
  { id: "demo-3", codigo: "HV-CFM-2026-0003", clienteNome: "Cliente de Exemplo C", tipo: "CFM_CRM", diasNoEstado: 41, valor: 15600, inadimplente: true, proximoPasso: "Cobrança" },
];

export const Route = createFileRoute("/design-system")({
  component: DesignSystem,
});

function DesignSystem() {
  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Sistema" }, { label: "Design System" }]} />
      <PageHeader
        eyebrow="QA visual · catálogo"
        title="Design System"
        subtitle="Componentes signature do sistema Hyago Viana — para validação rápida de consistência."
      />

      <Section title="Tipografia">
        <Card className="space-y-5">
          <div>
            <Eyebrow>Hero title</Eyebrow>
            <div className="font-display text-[60px] font-bold text-[var(--navy)] leading-tight tracking-tight">A excelência é detalhe.</div>
          </div>
          <div>
            <Eyebrow>Page H1</Eyebrow>
            <div className="font-display text-[44px] font-bold text-[var(--navy)] h1-ornament">Pipeline Operacional</div>
          </div>
          <div>
            <Eyebrow>Section title</Eyebrow>
            <div className="font-display text-[28px] font-semibold text-[var(--navy)]">Conquistas recentes</div>
          </div>
          <div>
            <blockquote className="editorial-quote">
              A justiça que tarda chega tarde, mas chega — desde que alguém esteja disposto a esperá-la com método.
            </blockquote>
          </div>
        </Card>
      </Section>

      <Section title="Paleta">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Navy", "#1e2044"],
            ["Navy 800", "#11132a"],
            ["Gold", "#987814"],
            ["Gold light", "#d4a832"],
            ["Gold pale", "#fbf3dd"],
          ].map(([n, c]) => (
            <div key={n} className="card-editorial !p-0 overflow-hidden">
              <div className="h-24" style={{ background: c }} />
              <div className="p-4">
                <div className="font-display text-[15px] text-[var(--navy)]">{n}</div>
                <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{c}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Botões">
        <Card className="flex flex-wrap gap-3">
          <Btn variant="primary"><Bell size={14} />Primary navy</Btn>
          <Btn variant="gold"><Plus size={14} />Gold premium</Btn>
          <Btn variant="outline"><Download size={14} />Outline</Btn>
          <Btn variant="ghost">Ghost</Btn>
          <Btn variant="danger">Danger</Btn>
        </Card>
      </Section>

      <Section title="Badges & Status">
        <Card className="flex flex-wrap gap-3 items-center">
          <Badge tone="gold">FIES ESF</Badge>
          <Badge tone="navy">Mais Médicos</Badge>
          <Badge tone="success">Implantado</Badge>
          <Badge tone="warning">Aguardando</Badge>
          <Badge tone="danger">Inadimplente</Badge>
          <Badge tone="neutral">Onboarding</Badge>
          <span className="ml-4 inline-flex items-center gap-2 text-[12px]">
            <span className="status-dot" style={{ background: "var(--success)", color: "var(--success)" }} /> Ativo
          </span>
          <MacrostatusOp status="EM_ANDAMENTO" />
          <MacrostatusFin status="QUITANDO" />
        </Card>
      </Section>

      <Section title="Cards & KPIs">
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <HeroStatCard label="Receita maio" value="R$ 487K" trend={{ value: "+18.4%", up: true }} context="vs abril" icon={Heart} />
          </div>
          <div className="grid gap-5">
            <StatCard label="Casos ativos" value="1.892" trend={{ value: "+12", up: true }} icon={Star} />
            <StatCard label="Conversão" value="32%" trend={{ value: "+3pp", up: true }} icon={Bell} />
          </div>
        </div>
      </Section>

      <Section title="Alertas">
        <div className="space-y-3">
          <AlertStrip tone="danger" title="Cliente com parcelas em atraso">2 boletos vencidos somando R$ 4.800.</AlertStrip>
          <AlertStrip tone="warning" title="Prazo se aproximando">Resposta ao MEC vence em 3 dias.</AlertStrip>
          <AlertStrip tone="success" title="Implantação confirmada">Caso FIES-2024-1247 implantado no SISFIES.</AlertStrip>
        </div>
      </Section>

      <Section title="Case Cards">
        <div className="grid md:grid-cols-3 gap-3">
          {sampleCases.map((c) => <CaseCard key={c.id} caso={c} compact={false} />)}
        </div>
      </Section>

      <OrnamentalDivider symbol="✦ ✦ ✦" />

      <p className="text-center text-muted-foreground italic font-display">— fim do catálogo —</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <SectionHeader eyebrow="Component" title={title} tone="navy" />
      {children}
    </section>
  );
}
