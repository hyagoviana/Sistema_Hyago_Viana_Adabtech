// Server-only — agregações do Dashboard Financeiro (S21).
// Lê system_parcelas e consolida recebido / a receber / vencido + projeção mensal.
// "Inadimplência" aqui = parcela VENCIDA (vencimento < hoje e não paga) — conceito
// por PARCELA, distinto da etapa macrostatus_fin='INADIMPLENTE' (por caso).

import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class FinanceiroServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FinanceiroServiceError";
  }
}

export type DashboardFinanceiro = {
  recebido_centavos: number;
  a_receber_centavos: number;
  vencido_centavos: number;
  qtd_parcelas: number;
  qtd_vencidas: number;
  por_mes: Array<{ mes: string; recebido_centavos: number; a_receber_centavos: number }>;
  vencidas: Array<{
    id: string;
    case_id: string;
    numero: number;
    valor_centavos: number;
    vencimento: string;
    dias_atraso: number;
  }>;
};

export async function getDashboardFinanceiro(): Promise<DashboardFinanceiro> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_parcelas")
    .select(
      "id, case_id, numero, valor_centavos, valor_pago_centavos, status, vencimento, data_pagamento",
    )
    .eq("organization_id", DEFAULT_ORG);
  if (error) throw new FinanceiroServiceError(error.message, 500);

  const hoje = new Date().toISOString().slice(0, 10);
  let recebido = 0;
  let aReceber = 0;
  let vencido = 0;
  let qtdVencidas = 0;
  const porMes: Record<string, { recebido_centavos: number; a_receber_centavos: number }> = {};
  const vencidas: DashboardFinanceiro["vencidas"] = [];

  const bump = (mes: string) => (porMes[mes] ??= { recebido_centavos: 0, a_receber_centavos: 0 });

  for (const p of data ?? []) {
    const valor = p.valor_centavos ?? 0;
    if (p.status === "PAGA") {
      const pago = p.valor_pago_centavos ?? valor;
      recebido += pago;
      const mes = (p.data_pagamento ?? "").slice(0, 7);
      if (mes) bump(mes).recebido_centavos += pago;
    } else if (p.status === "PENDENTE" || p.status === "VENCIDA") {
      // Parcela sem vencimento definido não pode ser avaliada como vencida
      if (!p.vencimento) {
        aReceber += valor;
        continue;
      }
      const atrasada = p.status === "VENCIDA" || p.vencimento < hoje;
      if (atrasada) {
        vencido += valor;
        qtdVencidas += 1;
        const dias = Math.max(
          0,
          Math.floor((Date.parse(hoje) - Date.parse(p.vencimento)) / (1000 * 60 * 60 * 24)),
        );
        vencidas.push({
          id: p.id,
          case_id: p.case_id,
          numero: p.numero,
          valor_centavos: valor,
          vencimento: p.vencimento,
          dias_atraso: dias,
        });
      } else {
        aReceber += valor;
      }
      const mes = p.vencimento.slice(0, 7);
      if (mes) bump(mes).a_receber_centavos += valor;
    }
  }

  const por_mes = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes, ...v }));

  vencidas.sort((a, b) => b.dias_atraso - a.dias_atraso);

  return {
    recebido_centavos: recebido,
    a_receber_centavos: aReceber,
    vencido_centavos: vencido,
    qtd_parcelas: (data ?? []).length,
    qtd_vencidas: qtdVencidas,
    por_mes,
    vencidas,
  };
}
