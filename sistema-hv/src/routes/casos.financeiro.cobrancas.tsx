import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, QrCode } from "lucide-react";
import { useState } from "react";

import { Breadcrumb, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllParcelas } from "@/hooks/useFinanceiro";

export const Route = createFileRoute("/casos/financeiro/cobrancas")({
  component: CobrancasPage,
});

function fmtBRL(centavos: number | null | undefined): string {
  if (!centavos) return "R$ 0,00";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  PAGA: { label: "Paga", cls: "bg-green-600 text-white" },
  VENCIDA: { label: "Vencida", cls: "bg-red-600 text-white" },
  CANCELADA: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  RENEGOCIADA: { label: "Renegociada", cls: "bg-blue-100 text-blue-800" },
};

const PROVIDER_BADGE: Record<string, { label: string; cls: string }> = {
  conta_azul: { label: "Conta Azul", cls: "bg-blue-50 text-blue-700" },
  asaas: { label: "Asaas", cls: "bg-emerald-50 text-emerald-700" },
};

function CobrancasPage() {
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const filters = statusFilter !== "TODOS" ? { status: statusFilter } : undefined;
  const { data: parcelas, isLoading, isError, error } = useAllParcelas(filters);

  const items = parcelas ?? [];

  // Totais
  const totalValor = items.reduce((s, p) => s + (p.valor_centavos ?? 0), 0);
  const totalPago = items
    .filter((p) => p.status === "PAGA")
    .reduce((s, p) => s + (p.valor_pago_centavos ?? p.valor_centavos ?? 0), 0);
  const totalPendente = items
    .filter((p) => p.status === "PENDENTE")
    .reduce((s, p) => s + (p.valor_centavos ?? 0), 0);
  const totalVencido = items
    .filter((p) => p.status === "VENCIDA")
    .reduce((s, p) => s + (p.valor_centavos ?? 0), 0);

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Painel", to: "/" },
          { label: "Financeiro", to: "/casos/financeiro" },
          { label: "Cobranças" },
        ]}
      />

      <PageHeader
        title="Cobranças e Pagamentos"
        subtitle={`${items.length} parcela(s) encontrada(s)`}
        aside={
          <Link to="/casos/financeiro" className="text-[var(--gold-700)] hover:underline text-sm inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Pipeline
          </Link>
        }
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card-hero p-5">
          <Eyebrow>Total</Eyebrow>
          <div className="text-[20px] font-semibold text-[var(--navy)] mt-1">{fmtBRL(totalValor)}</div>
        </div>
        <div className="card-hero p-5">
          <Eyebrow>Recebido</Eyebrow>
          <div className="text-[20px] font-semibold text-green-700 mt-1">{fmtBRL(totalPago)}</div>
        </div>
        <div className="card-hero p-5">
          <Eyebrow>Pendente</Eyebrow>
          <div className="text-[20px] font-semibold text-amber-700 mt-1">{fmtBRL(totalPendente)}</div>
        </div>
        <div className="card-hero p-5">
          <Eyebrow>Vencido</Eyebrow>
          <div className="text-[20px] font-semibold text-red-700 mt-1">{fmtBRL(totalVencido)}</div>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[12px] text-muted-foreground">Filtrar por status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="PAGA">Paga</SelectItem>
            <SelectItem value="VENCIDA">Vencida</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof Error ? error.message : "Erro ao carregar parcelas"}</AlertDescription>
        </Alert>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-[14px]">
          Nenhuma cobrança encontrada.
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="rounded-md border border-[var(--border)] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 bg-[var(--muted)] text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <span>Cliente</span>
            <span>Caso</span>
            <span>#</span>
            <span>Vencimento</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Provider</span>
          </div>

          {items.map((p) => {
            const meta = STATUS_BADGE[p.status] ?? STATUS_BADGE.PENDENTE;
            const provMeta = p.provider ? PROVIDER_BADGE[p.provider] : null;

            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2.5 border-t border-[var(--border)] items-center text-[13px] hover:bg-[var(--cream)] transition-colors"
              >
                <Link
                  to="/clientes/$id"
                  params={{ id: p.client_id }}
                  className="text-[var(--navy)] hover:text-[var(--gold-700)] hover:underline truncate font-medium"
                >
                  {p.client_name}
                </Link>

                <Link
                  to="/casos/$id"
                  params={{ id: p.case_id }}
                  className="text-[var(--navy)] hover:text-[var(--gold-700)] hover:underline font-mono text-[12px]"
                >
                  {p.case_code || p.case_id.slice(0, 8)}
                </Link>

                <span className="font-mono text-[12px] text-muted-foreground w-6">
                  {String(p.numero).padStart(2, "0")}
                </span>

                <span className="tabular-nums w-24">
                  {new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>

                <span className="font-medium text-[var(--navy)] tabular-nums w-28 text-right">
                  {fmtBRL(p.valor_centavos)}
                </span>

                <Badge className={`${meta.cls} text-[10px] w-20 justify-center`}>{meta.label}</Badge>

                {provMeta ? (
                  <Badge className={`${provMeta.cls} text-[9px] w-20 justify-center`}>
                    {provMeta.label}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground w-20 text-center">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
