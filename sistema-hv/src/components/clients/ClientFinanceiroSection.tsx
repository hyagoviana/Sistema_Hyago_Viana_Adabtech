import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/hv/primitives";
import { useAllParcelas } from "@/hooks/useFinanceiro";

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

export function ClientFinanceiroSection({ clientId }: { clientId: string }) {
  const { data: parcelas, isLoading } = useAllParcelas({ clientId });
  const items = parcelas ?? [];

  const totalValor = items.reduce((s, p) => s + (p.valor_centavos ?? 0), 0);
  const totalPago = items
    .filter((p) => p.status === "PAGA")
    .reduce((s, p) => s + (p.valor_pago_centavos ?? p.valor_centavos ?? 0), 0);
  const totalPendente = items
    .filter((p) => p.status === "PENDENTE" || p.status === "VENCIDA")
    .reduce((s, p) => s + (p.valor_centavos ?? 0), 0);
  const qtdPagas = items.filter((p) => p.status === "PAGA").length;

  return (
    <div>
      <h2 className="text-[19px] font-semibold text-[var(--navy)] mb-4">Financeiro do cliente</h2>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-[13px] py-4">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="card-hero p-6 text-center">
          <Receipt size={28} className="mx-auto text-muted-foreground mb-2" />
          <div className="text-[13px] text-muted-foreground">
            Nenhuma cobrança vinculada a este cliente.
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="card-hero p-4">
              <Eyebrow>Total cobrado</Eyebrow>
              <div className="text-[17px] font-semibold text-[var(--navy)] mt-1">
                {fmtBRL(totalValor)}
              </div>
            </div>
            <div className="card-hero p-4">
              <Eyebrow>Recebido</Eyebrow>
              <div className="text-[17px] font-semibold text-green-700 mt-1">
                {fmtBRL(totalPago)}
              </div>
              <div className="text-[11px] text-muted-foreground">{qtdPagas} parcela(s)</div>
            </div>
            <div className="card-hero p-4">
              <Eyebrow>A receber</Eyebrow>
              <div className="text-[17px] font-semibold text-amber-700 mt-1">
                {fmtBRL(totalPendente)}
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-md border border-[var(--border)] overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 bg-[var(--muted)] text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
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
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2.5 border-t border-[var(--border)] items-center text-[13px] hover:bg-[var(--cream)] transition-colors"
                >
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

                  <span className="font-medium text-[var(--navy)] tabular-nums w-24 text-right">
                    {fmtBRL(p.valor_centavos)}
                  </span>

                  <Badge className={`${meta.cls} text-[10px] w-20 justify-center`}>
                    {meta.label}
                  </Badge>

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

            {/* Rodapé */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2.5 border-t-2 border-[var(--navy)] bg-[var(--cream)]">
              <span className="text-[12px] font-medium text-[var(--navy)]">
                {items.length} parcela(s)
              </span>
              <span />
              <span />
              <span className="font-semibold text-[var(--navy)] tabular-nums text-[13px] w-24 text-right">
                {fmtBRL(totalValor)}
              </span>
              <Badge className="bg-green-100 text-green-800 text-[10px] w-20 justify-center">
                {qtdPagas} paga(s)
              </Badge>
              <span />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
