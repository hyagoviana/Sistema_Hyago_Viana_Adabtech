import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardFinanceiro, useRelatorioFinanceiro, useSyncAllPagamentos } from "@/hooks/useFinanceiro";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";

export const Route = createFileRoute("/relatorio-financeiro")({
  component: RelatorioFinanceiro,
});

function fmtBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PROVIDER_LABEL: Record<string, string> = {
  asaas: "Asaas",
  conta_azul: "Conta Azul",
};

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card-hero p-5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="text-[22px] font-semibold mt-1" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function RelatorioFinanceiro() {
  const navigate = useNavigate();
  const { data: dash, isLoading: dashLoading } = useDashboardFinanceiro();
  const { data: casos, isLoading, isError, error } = useRelatorioFinanceiro();
  const syncAll = useSyncAllPagamentos();

  function handleSync() {
    syncAll.mutate(undefined, {
      onSuccess: (r) => {
        const asaasOk = r.asaas && "atualizadas" in r.asaas ? r.asaas.atualizadas : 0;
        const caOk = r.contaAzul && "atualizadas" in r.contaAzul ? r.contaAzul.atualizadas : 0;
        toast.success(`Sync concluído · Asaas: ${asaasOk} atualizada(s), Conta Azul: ${caOk} atualizada(s)`);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"),
    });
  }

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Relatório Financeiro" }]} />
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Operação"
          title="Relatório Financeiro"
          subtitle="Valores pagos e pendentes por caso · consolidando Asaas, Conta Azul e cobranças manuais."
        />
        <Button
          variant="outline"
          size="sm"
          disabled={syncAll.isPending}
          onClick={handleSync}
          className="mt-2 shrink-0"
        >
          {syncAll.isPending ? (
            <Loader2 size={13} className="mr-1.5 animate-spin" />
          ) : (
            <RefreshCw size={13} className="mr-1.5" />
          )}
          Sincronizar pagamentos
        </Button>
      </div>

      {/* Totais gerais (mesma fonte do dashboard financeiro) */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {dashLoading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : (
          <>
            <KpiCard
              label="Recebido"
              value={fmtBRL(dash?.recebido_centavos ?? 0)}
              tone="var(--success)"
            />
            <KpiCard
              label="A receber"
              value={fmtBRL(dash?.a_receber_centavos ?? 0)}
              tone="var(--navy)"
            />
            <KpiCard
              label="Vencido"
              value={fmtBRL(dash?.vencido_centavos ?? 0)}
              tone="var(--danger)"
            />
          </>
        )}
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar o relatório: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      <div className="card-editorial !p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] text-[13px] font-semibold text-[var(--navy)]">
          Por caso
        </div>
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (casos ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum caso com cobranças/parcelas ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[var(--border)]">
                  <th className="px-5 py-2.5 font-medium">Caso</th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 font-medium">Plataforma</th>
                  <th className="px-3 py-2.5 font-medium text-right">Pago</th>
                  <th className="px-3 py-2.5 font-medium text-right">Pendente</th>
                  <th className="px-3 py-2.5 font-medium text-right">Vencido</th>
                  <th className="px-5 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(casos ?? []).map((c) => (
                  <tr
                    key={c.case_id}
                    onClick={() => navigate({ to: "/casos/$id", params: { id: c.case_id } })}
                    className="border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors hover:bg-[var(--ink-50)]"
                  >
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-[var(--navy)] hover:underline">
                        {c.case_code}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[180px]">
                      {c.client_name}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {c.providers.length
                        ? c.providers.map((p) => PROVIDER_LABEL[p] ?? p).join(", ")
                        : "·"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--success)]">
                      {fmtBRL(c.pago_centavos)}
                    </td>
                    <td className="px-3 py-2.5 text-right">{fmtBRL(c.pendente_centavos)}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--danger)]">
                      {fmtBRL(c.vencido_centavos)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-[var(--navy)]">
                      {fmtBRL(c.total_centavos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
