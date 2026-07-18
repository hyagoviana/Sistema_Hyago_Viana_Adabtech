import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardFinanceiro } from "@/hooks/useFinanceiro";
import { useMyModulePerms } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { permissaoEfetiva } from "@/lib/rbac";

export const Route = createFileRoute("/dashboards/financeiro")({
  component: DashboardFinanceiro,
});

function brl(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}

function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  return `${m}/${y}`;
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card-hero p-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-[26px] font-semibold" style={{ color: tone ?? "var(--navy)" }}>
        {value}
      </div>
    </div>
  );
}

function DashboardFinanceiro() {
  // R4-03 — gate de $ no dashboard. Mesma infra efetiva de R4-01
  // (permissaoEfetiva combina PAPEL + overrides por usuário×módulo). O RPC
  // getDashboardFinanceiroFn já barra os dados no servidor (403); este guard
  // evita renderizar a casca visual com totais para quem não tem financeiro:view.
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  const podeVerFinanceiro = permissaoEfetiva(role, perms ?? {}, "financeiro", "view");

  if (!podeVerFinanceiro) {
    return (
      <div className="page-container">
        <Breadcrumb items={[{ label: "Dashboards", to: "/dashboards" }, { label: "Financeiro" }]} />
        <PageHeader eyebrow="Dashboards" title="Financeiro" />
        <Alert className="mt-4">
          <AlertDescription>
            Você não tem permissão para visualizar o dashboard financeiro.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <DashboardFinanceiroContent />;
}

function DashboardFinanceiroContent() {
  const { data, isLoading, isError, error } = useDashboardFinanceiro();

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Dashboards", to: "/dashboards" }, { label: "Financeiro" }]} />
      <PageHeader
        eyebrow="Dashboards"
        title="Financeiro"
        subtitle="Recebimentos, projeção e parcelas vencidas."
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card label="Recebido" value={brl(data?.recebido_centavos)} tone="var(--success)" />
            <Card label="A receber" value={brl(data?.a_receber_centavos)} />
            <Card label="Vencido" value={brl(data?.vencido_centavos)} tone="var(--danger)" />
          </div>

          {(data?.por_mes ?? []).length > 0 && (
            <div className="card-editorial mt-6 p-6">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
                Projeção mensal
              </div>
              <ul className="space-y-2 text-[13px]">
                {(data?.por_mes ?? []).map((m) => (
                  <li
                    key={m.mes}
                    className="flex items-center justify-between border-b border-[var(--border)] pb-2"
                  >
                    <span className="font-medium text-[var(--navy)]">{mesLabel(m.mes)}</span>
                    <span className="flex items-center gap-4 text-muted-foreground">
                      <span>recebido {brl(m.recebido_centavos)}</span>
                      <span>a receber {brl(m.a_receber_centavos)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card-editorial mt-6 p-6">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
              Parcelas vencidas ({data?.qtd_vencidas ?? 0})
            </div>
            {(data?.vencidas ?? []).length === 0 ? (
              <div className="text-[13px] text-muted-foreground">
                Nenhuma parcela vencida. 🎉
              </div>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {(data?.vencidas ?? []).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between border-b border-[var(--border)] pb-2"
                  >
                    <span>
                      Parcela {String(v.numero).padStart(2, "0")} · venceu{" "}
                      {new Date(v.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                    <span className="flex items-center gap-2">
                      {brl(v.valor_centavos)}
                      <Badge className="bg-[var(--danger)] text-white">{v.dias_atraso}d</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
