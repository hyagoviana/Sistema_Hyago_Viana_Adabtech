import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Briefcase,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Scale,
} from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";

export const Route = createFileRoute("/dashboards/admin")({
  component: AdminDash,
});

function brl(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  to,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: string;
  to?: string;
}) {
  const content = (
    <div className="card-hero p-6 group">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div
            className="mt-2 text-[28px] font-semibold"
            style={{ color: tone ?? "var(--navy)" }}
          >
            {value}
          </div>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{
            background: tone
              ? `linear-gradient(135deg, ${tone}, ${tone}cc)`
              : "linear-gradient(135deg, #d4a832, #987814)",
            boxShadow: `0 8px 20px -6px ${tone ?? "rgba(152,120,20,0.35)"}55`,
          }}
        >
          <Icon size={20} strokeWidth={1.75} />
        </div>
      </div>
      {to && (
        <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--gold-700)] group-hover:gap-2 transition-all">
          Ver detalhes <ArrowRight size={12} />
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to as any} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
      {children}
    </div>
  );
}

function AdminDash() {
  const { data, isLoading, isError, error } = useAdminDashboard();

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Dashboards", to: "/dashboards" }, { label: "Admin" }]} />
      <PageHeader
        eyebrow="Visão executiva"
        title="Dashboard Admin"
        subtitle="Visão consolidada 360º — casos, clientes, financeiro e operacional."
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total de Casos"
              value={data?.total_casos ?? 0}
              icon={Briefcase}
              to="/pipeline"
            />
            <KpiCard
              label="Total de Clientes"
              value={data?.total_clientes ?? 0}
              icon={Users}
              to="/clientes"
            />
            <KpiCard
              label="Recebido"
              value={brl(data?.total_recebido_centavos)}
              icon={DollarSign}
              tone="var(--success, #16a34a)"
              to="/dashboards/financeiro"
            />
            <KpiCard
              label="Vencido"
              value={brl(data?.total_vencido_centavos)}
              icon={AlertTriangle}
              tone="var(--danger, #dc2626)"
              to="/dashboards/financeiro"
            />
          </div>

          {/* Inadimplentes */}
          {(data?.casos_inadimplentes ?? 0) > 0 && (
            <Link to="/casos/financeiro" className="block mt-4">
              <Alert className="border-[var(--danger,#dc2626)] bg-red-50 dark:bg-red-950/20 cursor-pointer hover:bg-red-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-[var(--danger,#dc2626)]" />
                <AlertDescription className="text-[var(--danger,#dc2626)] font-medium">
                  {data?.casos_inadimplentes} caso(s) marcado(s) como inadimplente — clique para ver
                  no pipeline financeiro
                </AlertDescription>
              </Alert>
            </Link>
          )}

          {/* Distribuição por tipo e status */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {/* Por tipo */}
            <div className="card-editorial p-6">
              <SectionTitle>Casos por tipo</SectionTitle>
              {(data?.casos_por_tipo ?? []).length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum caso.</p>
              ) : (
                <ul className="space-y-2">
                  {(data?.casos_por_tipo ?? []).map((t) => (
                    <li
                      key={t.tipo}
                      className="flex items-center justify-between text-[13px] border-b border-[var(--border)] pb-2"
                    >
                      <span className="font-medium text-[var(--navy)]">{t.label}</span>
                      <Badge variant="secondary" className="font-semibold">
                        {t.qtd}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Por status operacional */}
            <div className="card-editorial p-6">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Status operacional</SectionTitle>
                <Link
                  to="/pipeline"
                  className="text-[11px] text-[var(--gold-700)] font-medium hover:underline"
                >
                  Ver pipeline →
                </Link>
              </div>
              {(data?.casos_por_status_op ?? []).length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum caso.</p>
              ) : (
                <ul className="space-y-2">
                  {(data?.casos_por_status_op ?? []).map((s) => (
                    <li
                      key={s.status}
                      className="flex items-center justify-between text-[13px] border-b border-[var(--border)] pb-2"
                    >
                      <span className="text-[var(--navy)]">{s.label}</span>
                      <Badge variant="outline" className="font-semibold">
                        {s.qtd}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Por status financeiro */}
            <div className="card-editorial p-6">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Status financeiro</SectionTitle>
                <Link
                  to="/casos/financeiro"
                  className="text-[11px] text-[var(--gold-700)] font-medium hover:underline"
                >
                  Ver pipeline →
                </Link>
              </div>
              {(data?.casos_por_status_fin ?? []).length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum caso.</p>
              ) : (
                <ul className="space-y-2">
                  {(data?.casos_por_status_fin ?? []).map((s) => (
                    <li
                      key={s.status}
                      className="flex items-center justify-between text-[13px] border-b border-[var(--border)] pb-2"
                    >
                      <span className="text-[var(--navy)]">{s.label}</span>
                      <Badge variant="outline" className="font-semibold">
                        {s.qtd}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Casos e clientes recentes */}
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {/* Casos recentes */}
            <div className="card-editorial p-6">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Casos recentes</SectionTitle>
                <Link
                  to="/pipeline"
                  className="text-[11px] text-[var(--gold-700)] font-medium hover:underline"
                >
                  Ver todos →
                </Link>
              </div>
              {(data?.casos_recentes ?? []).length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum caso ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {(data?.casos_recentes ?? []).map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start justify-between text-[13px] border-b border-[var(--border)] pb-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--navy)] flex items-center gap-2">
                          <Scale size={13} className="shrink-0 text-muted-foreground" />
                          {c.case_code}
                        </div>
                        <div className="text-muted-foreground mt-0.5 truncate">
                          {c.client_name}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-muted-foreground">{formatDate(c.created_at)}</div>
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {c.macrostatus_op}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Clientes recentes */}
            <div className="card-editorial p-6">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Clientes recentes</SectionTitle>
                <Link
                  to="/clientes"
                  className="text-[11px] text-[var(--gold-700)] font-medium hover:underline"
                >
                  Ver todos →
                </Link>
              </div>
              {(data?.clientes_recentes ?? []).length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum cliente ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {(data?.clientes_recentes ?? []).map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between text-[13px] border-b border-[var(--border)] pb-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--navy)] flex items-center gap-2">
                          <Users size={13} className="shrink-0 text-muted-foreground" />
                          {c.full_name}
                        </div>
                        {c.cpf_cnpj && (
                          <div className="text-muted-foreground mt-0.5 text-[12px]">
                            {c.cpf_cnpj}
                          </div>
                        )}
                      </div>
                      <div className="text-muted-foreground shrink-0 ml-3">
                        {formatDate(c.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Links rápidos */}
          <div className="card-editorial p-6 mt-6">
            <SectionTitle>Acesso rápido</SectionTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { to: "/pipeline", label: "Pipeline Operacional", icon: Briefcase },
                { to: "/casos/financeiro", label: "Pipeline Financeiro", icon: DollarSign },
                { to: "/clientes", label: "Clientes", icon: Users },
                { to: "/dashboards/financeiro", label: "Dashboard Financeiro", icon: TrendingUp },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to as any}
                    className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--gold-500)] hover:bg-[var(--gold-50,#fef9ee)] transition-colors group"
                  >
                    <Icon size={16} className="text-muted-foreground group-hover:text-[var(--gold-700)]" />
                    <span className="text-[13px] font-medium text-[var(--navy)]">{link.label}</span>
                    <ArrowRight size={12} className="ml-auto text-muted-foreground group-hover:text-[var(--gold-700)]" />
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
