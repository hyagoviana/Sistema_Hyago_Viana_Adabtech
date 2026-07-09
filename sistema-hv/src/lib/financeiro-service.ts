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

// ─── Listar todas as parcelas (global ou por cliente) ─────────────────────────

export type ParcelaComCaso = {
  id: string;
  case_id: string;
  case_code: string;
  client_id: string;
  client_name: string;
  numero: number;
  valor_centavos: number;
  valor_pago_centavos: number | null;
  vencimento: string;
  status: string;
  provider: string | null;
  provider_ext_id: string | null;
  boleto_url: string | null;
  metodo_pagamento: string | null;
  data_pagamento: string | null;
};

export async function listAllParcelas(filters?: {
  clientId?: string;
  status?: string;
}): Promise<ParcelaComCaso[]> {
  const sb = getSupabaseAdmin();

  let query = sb
    .from("system_parcelas")
    .select(
      "id, case_id, numero, valor_centavos, valor_pago_centavos, vencimento, status, provider, provider_ext_id, boleto_url, metodo_pagamento, data_pagamento",
    )
    .eq("organization_id", DEFAULT_ORG)
    .order("vencimento", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data: parcelas, error } = await query;
  if (error) throw new FinanceiroServiceError(error.message, 500);

  if (!parcelas || parcelas.length === 0) return [];

  // Buscar case_code e client_id dos casos
  const caseIds = [...new Set(parcelas.map((p) => p.case_id))];
  const { data: cases } = await sb
    .from("system_cases")
    .select("id, case_code, client_id")
    .in("id", caseIds);

  const caseMap = new Map(
    (cases ?? []).map((c) => [c.id, { case_code: c.case_code, client_id: c.client_id }]),
  );

  // Buscar nomes dos clientes
  const clientIds = [...new Set((cases ?? []).map((c) => c.client_id))];
  const { data: clients } = await sb
    .from("system_clients")
    .select("id, full_name")
    .in("id", clientIds);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));

  // Montar resultado
  let result: ParcelaComCaso[] = parcelas.map((p) => {
    const caso = caseMap.get(p.case_id);
    return {
      ...p,
      case_code: caso?.case_code ?? "",
      client_id: caso?.client_id ?? "",
      client_name: clientMap.get(caso?.client_id ?? "") ?? "",
    };
  });

  // Filtrar por cliente se solicitado
  if (filters?.clientId) {
    result = result.filter((p) => p.client_id === filters.clientId);
  }

  return result;
}

// ─── Relatório financeiro POR CASO (item 3, 2026-07-09) ───────────────────────
// Consolida as parcelas de cada caso (independente do provider: Asaas / Conta Azul
// / manual): total, pago, pendente e vencido. Os valores pagos vêm do webhook das
// plataformas (system_parcelas.valor_pago_centavos / status).
export type RelatorioCasoFinanceiro = {
  case_id: string;
  case_code: string;
  client_id: string;
  client_name: string;
  case_type: string;
  total_centavos: number;
  pago_centavos: number;
  pendente_centavos: number;
  vencido_centavos: number;
  qtd_parcelas: number;
  providers: string[];
};

export async function getRelatorioFinanceiroPorCaso(): Promise<RelatorioCasoFinanceiro[]> {
  const sb = getSupabaseAdmin();
  const { data: parcelas, error } = await sb
    .from("system_parcelas")
    .select("case_id, valor_centavos, valor_pago_centavos, status, vencimento, provider")
    .eq("organization_id", DEFAULT_ORG);
  if (error) throw new FinanceiroServiceError(error.message, 500);
  if (!parcelas || parcelas.length === 0) return [];

  const hoje = new Date().toISOString().slice(0, 10);
  const byCase = new Map<
    string,
    Omit<RelatorioCasoFinanceiro, "case_code" | "client_id" | "client_name" | "case_type"> & {
      providersSet: Set<string>;
    }
  >();

  for (const p of parcelas) {
    const entry =
      byCase.get(p.case_id) ??
      (() => {
        const e = {
          case_id: p.case_id,
          total_centavos: 0,
          pago_centavos: 0,
          pendente_centavos: 0,
          vencido_centavos: 0,
          qtd_parcelas: 0,
          providers: [] as string[],
          providersSet: new Set<string>(),
        };
        byCase.set(p.case_id, e);
        return e;
      })();

    const valor = p.valor_centavos ?? 0;
    entry.total_centavos += valor;
    entry.qtd_parcelas += 1;
    if (p.provider) entry.providersSet.add(p.provider);

    if (p.status === "PAGA") {
      entry.pago_centavos += p.valor_pago_centavos ?? valor;
    } else if (p.status === "VENCIDA" || (p.vencimento && p.vencimento < hoje)) {
      entry.vencido_centavos += valor;
    } else if (p.status === "PENDENTE") {
      entry.pendente_centavos += valor;
    }
  }

  const caseIds = [...byCase.keys()];
  const { data: cases } = await sb
    .from("system_cases")
    .select("id, case_code, client_id, case_type")
    .in("id", caseIds);
  const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
  const clientIds = [...new Set((cases ?? []).map((c) => c.client_id))];
  const { data: clients } = await sb
    .from("system_clients")
    .select("id, full_name")
    .in("id", clientIds);
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));

  return [...byCase.values()]
    .map((e) => {
      const caso = caseMap.get(e.case_id);
      const { providersSet, ...rest } = e;
      return {
        ...rest,
        providers: [...providersSet],
        case_code: caso?.case_code ?? "—",
        client_id: caso?.client_id ?? "",
        client_name: clientMap.get(caso?.client_id ?? "") ?? "—",
        case_type: caso?.case_type ?? "",
      };
    })
    .sort((a, b) => b.total_centavos - a.total_centavos);
}

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
