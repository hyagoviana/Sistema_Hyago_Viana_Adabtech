// Server-only — agregações do Dashboard Admin Consolidado.
// Lê system_cases, system_clients e system_parcelas para montar visão 360º.

import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class AdminDashboardServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AdminDashboardServiceError";
  }
}

export type DashboardAdmin = {
  // Totais
  total_casos: number;
  total_clientes: number;
  total_recebido_centavos: number;
  total_vencido_centavos: number;

  // Casos por tipo
  casos_por_tipo: Array<{ tipo: string; label: string; qtd: number }>;

  // Casos por status operacional
  casos_por_status_op: Array<{ status: string; label: string; qtd: number }>;

  // Casos por status financeiro
  casos_por_status_fin: Array<{ status: string; label: string; qtd: number }>;

  // Últimos 10 casos criados
  casos_recentes: Array<{
    id: string;
    case_code: string;
    case_type: string;
    macrostatus_op: string;
    macrostatus_fin: string;
    client_name: string;
    created_at: string;
  }>;

  // Últimos 10 clientes criados
  clientes_recentes: Array<{
    id: string;
    full_name: string;
    cpf_cnpj: string;
    created_at: string;
  }>;

  // Casos inadimplentes
  casos_inadimplentes: number;
};

const CASE_TYPE_LABELS: Record<string, string> = {
  FIES_ESF: "FIES ESF",
  FIES_DGM: "FIES DGM",
  COVID: "COVID",
  MAIS_MEDICOS: "Mais Médicos",
  RESIDENCIA: "Residência",
  CFM_CRM: "CFM/CRM",
};

const MACRO_OP_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  TRIAGEM: "Triagem",
  DOCS_PENDENTES: "Docs pendentes",
  DGM_ENVIADA: "DGM enviada",
  PRONTO_PROTOCOLO: "Pronto p/ protocolo",
  ACOMPANHAMENTO_ADM: "Acompanhamento adm.",
  JUDICIAL_OPERACIONAL: "Judicial",
  IMPLANTADO: "Implantado",
  ENCERRADO_OPERACIONAL: "Encerrado",
  CANCELADO: "Cancelado",
};

const MACRO_FIN_LABELS: Record<string, string> = {
  NAO_APLICAVEL: "—",
  ELABORANDO: "Elaborando",
  APROVACAO: "Aprovação",
  AGUARDANDO_ATIVACAO: "Aguardando ativação",
  ATIVO: "Ativo",
  QUITANDO: "Quitando",
  QUITADO: "Quitado",
  INADIMPLENTE: "Inadimplente",
  PARCIAL: "Parcial",
  RENEGOCIADO: "Renegociado",
  SUSPENSO: "Suspenso",
  CANCELADO: "Cancelado",
};

export async function getDashboardAdmin(): Promise<DashboardAdmin> {
  const sb = getSupabaseAdmin();

  // Buscar dados em paralelo
  const [casesRes, clientsRes, parcelasRes] = await Promise.all([
    sb
      .from("system_cases")
      .select("id, case_code, case_type, macrostatus_op, macrostatus_fin, client_id, inadimplente, created_at")
      .eq("organization_id", DEFAULT_ORG)
      .is("deleted_at", null),
    sb
      .from("system_clients")
      .select("id, full_name, cpf_cnpj, created_at")
      .eq("organization_id", DEFAULT_ORG)
      .is("deleted_at", null),
    sb
      .from("system_parcelas")
      .select("id, valor_centavos, valor_pago_centavos, status, vencimento")
      .eq("organization_id", DEFAULT_ORG),
  ]);

  if (casesRes.error) throw new AdminDashboardServiceError(casesRes.error.message, 500);
  if (clientsRes.error) throw new AdminDashboardServiceError(clientsRes.error.message, 500);
  if (parcelasRes.error) throw new AdminDashboardServiceError(parcelasRes.error.message, 500);

  const cases = casesRes.data ?? [];
  const clients = clientsRes.data ?? [];
  const parcelas = parcelasRes.data ?? [];

  // Mapa de clientes para lookup
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  // Contagem por tipo
  const tipoCount: Record<string, number> = {};
  for (const c of cases) {
    tipoCount[c.case_type] = (tipoCount[c.case_type] ?? 0) + 1;
  }
  const casos_por_tipo = Object.entries(tipoCount)
    .map(([tipo, qtd]) => ({ tipo, label: CASE_TYPE_LABELS[tipo] ?? tipo, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  // Contagem por status operacional
  const opCount: Record<string, number> = {};
  for (const c of cases) {
    opCount[c.macrostatus_op] = (opCount[c.macrostatus_op] ?? 0) + 1;
  }
  const casos_por_status_op = Object.entries(opCount)
    .map(([status, qtd]) => ({ status, label: MACRO_OP_LABELS[status] ?? status, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  // Contagem por status financeiro
  const finCount: Record<string, number> = {};
  for (const c of cases) {
    finCount[c.macrostatus_fin] = (finCount[c.macrostatus_fin] ?? 0) + 1;
  }
  const casos_por_status_fin = Object.entries(finCount)
    .map(([status, qtd]) => ({ status, label: MACRO_FIN_LABELS[status] ?? status, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  // Últimos 10 casos
  const casosOrdenados = [...cases].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const casos_recentes = casosOrdenados.slice(0, 10).map((c) => ({
    id: c.id,
    case_code: c.case_code,
    case_type: c.case_type,
    macrostatus_op: c.macrostatus_op,
    macrostatus_fin: c.macrostatus_fin,
    client_name: clientMap.get(c.client_id) ?? "—",
    created_at: c.created_at,
  }));

  // Últimos 10 clientes
  const clientesOrdenados = [...clients].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const clientes_recentes = clientesOrdenados.slice(0, 10).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    cpf_cnpj: c.cpf_cnpj ?? "",
    created_at: c.created_at,
  }));

  // Financeiro resumido
  const hoje = new Date().toISOString().slice(0, 10);
  let recebido = 0;
  let vencido = 0;
  for (const p of parcelas) {
    const valor = p.valor_centavos ?? 0;
    if (p.status === "PAGA") {
      recebido += p.valor_pago_centavos ?? valor;
    } else if (p.status === "VENCIDA" || (p.status === "PENDENTE" && p.vencimento && p.vencimento < hoje)) {
      vencido += valor;
    }
  }

  // Casos inadimplentes
  const casos_inadimplentes = cases.filter((c) => c.inadimplente === true).length;

  return {
    total_casos: cases.length,
    total_clientes: clients.length,
    total_recebido_centavos: recebido,
    total_vencido_centavos: vencido,
    casos_por_tipo,
    casos_por_status_op,
    casos_por_status_fin,
    casos_recentes,
    clientes_recentes,
    casos_inadimplentes,
  };
}
