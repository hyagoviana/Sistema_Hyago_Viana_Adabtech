import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { DollarSign, Users, TrendingUp, AlertTriangle, Briefcase, Megaphone } from "lucide-react";
import { Breadcrumb, PageHeader, Eyebrow, OrnamentalDivider, HeroStatCard, StatCard, CardHero } from "@/components/hv/primitives";
import { dashSeries } from "@/mocks/fixtures";

export const Route = createFileRoute("/dashboards/admin")({
  component: AdminDash,
});

function AdminDash() {
  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Dashboards", to: "/dashboards" }, { label: "Admin" }]} />
      <PageHeader
        eyebrow="Visão executiva"
        title="Dashboard Admin"
        subtitle="Painel consolidado · 360º do escritório · todos os pipelines convergindo."
        aside={
          <div className="text-right">
            <Eyebrow>Último update</Eyebrow>
            <div className="font-display text-[18px] text-[var(--navy)] mt-1">14:32</div>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <HeroStatCard
            label="Receita recuperada · maio"
            value="R$ 487K"
            trend={{ value: "+18.4% vs abr", up: true }}
            context="Meta mensal: R$ 520K · projeção fechamento R$ 538K"
            icon={DollarSign}
          />
        </div>
        <div className="grid gap-5">
          <StatCard label="Casos ativos" value="1.892" trend={{ value: "+12", up: true }} icon={Briefcase} />
          <StatCard label="Implantados (mês)" value="142" trend={{ value: "+8.1%", up: true }} icon={TrendingUp} />
        </div>
      </div>

      <OrnamentalDivider />

      <div className="grid md:grid-cols-3 gap-5">
        <StatCard label="Inadimplência" value="6.4%" trend={{ value: "-1.2pp", up: true }} context="32 casos" icon={AlertTriangle} />
        <StatCard label="Leads novos (30d)" value="247" trend={{ value: "+24%", up: true }} context="42% qualificados" icon={Users} />
        <StatCard label="Taxa conversão" value="32.4%" trend={{ value: "+3.1pp", up: true }} context="lead → cliente" icon={Megaphone} />
      </div>

      <OrnamentalDivider />

      <CardHero className="mb-8">
        <Eyebrow>Recuperação mensal</Eyebrow>
        <h3 className="font-display text-[26px] font-semibold text-[var(--navy)] mt-2 mb-6">
          Últimos 12 meses · em milhares
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashSeries}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a832" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#987814" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,32,68,0.06)" />
              <XAxis dataKey="mes" stroke="#8d90a8" fontSize={11} />
              <YAxis stroke="#8d90a8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(30,32,68,0.12)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="receita" stroke="#987814" strokeWidth={2.5} fill="url(#goldGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardHero>

      <div className="grid lg:grid-cols-2 gap-5">
        <CardHero>
          <Eyebrow>Casos por mês</Eyebrow>
          <h3 className="font-display text-[22px] font-semibold text-[var(--navy)] mt-2 mb-5">Volume operacional</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,32,68,0.06)" />
                <XAxis dataKey="mes" stroke="#8d90a8" fontSize={11} />
                <YAxis stroke="#8d90a8" fontSize={11} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(30,32,68,0.12)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="casos" radius={[6, 6, 0, 0]}>
                  {dashSeries.map((_, i) => (
                    <Cell key={i} fill={i === dashSeries.length - 1 ? "#987814" : "#1e2044"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardHero>

        <CardHero>
          <Eyebrow>Conversão comercial</Eyebrow>
          <h3 className="font-display text-[22px] font-semibold text-[var(--navy)] mt-2 mb-5">Lead → cliente (%)</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashSeries}>
                <defs>
                  <linearGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e2044" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1e2044" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,32,68,0.06)" />
                <XAxis dataKey="mes" stroke="#8d90a8" fontSize={11} />
                <YAxis stroke="#8d90a8" fontSize={11} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(30,32,68,0.12)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="conversao" stroke="#1e2044" strokeWidth={2.5} fill="url(#navyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardHero>
      </div>
    </div>
  );
}
