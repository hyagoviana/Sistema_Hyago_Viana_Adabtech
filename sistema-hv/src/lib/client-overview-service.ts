// Server-only — S3-04: a visão 360 do cliente.
//
// Thiago (desenhos 33-35): "Vamos unificar a visualização de 'valores do cliente'
// junto aos casos de cada valor. Também vamos unificar a visualização da etapa
// principal de cada caso. (…) A ideia não é ter todo o detalhamento, isso temos
// na página financeiro do próprio caso. Aqui é um visual geral integral de tudo
// que é do cliente como um todo."
//
// POR QUE UM SERVIÇO PRÓPRIO, e não chamar `resumoFinanceiroCaso` por caso: essa
// função faz três consultas por caso (entries, parcelas, categorias). Um cliente
// com 8 casos custaria 24 idas ao banco só para desenhar a ficha — o AC8 pede
// UMA consulta por coleção, não N+1.
//
// A RÉGUA de devido/vencido/pago/a vencer não é reescrita aqui: mora em
// `agregarParcelas`, a mesma função que `resumoFinanceiroCaso` passou a usar.
// Duas cópias da régua divergiriam no primeiro ajuste, e a ficha do cliente
// passaria a mostrar número diferente da aba Financeiro do caso.

import { statusEfetivoParcela } from "./financeiro-caso-shared";
import { getSupabaseAdmin } from "./supabase/server";

export type ResumoValores = {
  devido_centavos: number;
  vencido_centavos: number;
  pago_centavos: number;
  vincendo_centavos: number;
};

export type CasoDoCliente = {
  id: string;
  case_code: string | null;
  /** Nome da pasta do caso — é o rótulo humano que a lista já usa. */
  caso_pasta_nome: string | null;
  tema_id: string | null;
  tema_nome: string | null;
  lifecycle: string | null;
  /** Etapa do kanban principal (operacional), já traduzida. */
  etapa_operacional: string | null;
  /** Etapa da pipeline financeira, já traduzida. */
  etapa_financeira: string | null;
  /** Rastro comercial: em que etapa está, ou como terminou. */
  etapa_comercial: string | null;
  receitas: ResumoValores;
  despesas: ResumoValores;
};

export type ClientOverview = {
  casos: CasoDoCliente[];
  /** Somatório dos casos — o "valores do cliente" deixa de ser uma ilha. */
  totalReceitas: ResumoValores;
  totalDespesas: ResumoValores;
};

const ZERO = (): ResumoValores => ({
  devido_centavos: 0,
  vencido_centavos: 0,
  pago_centavos: 0,
  vincendo_centavos: 0,
});

function soma(a: ResumoValores, b: ResumoValores): ResumoValores {
  return {
    devido_centavos: a.devido_centavos + b.devido_centavos,
    vencido_centavos: a.vencido_centavos + b.vencido_centavos,
    pago_centavos: a.pago_centavos + b.pago_centavos,
    vincendo_centavos: a.vincendo_centavos + b.vincendo_centavos,
  };
}

/**
 * A régua de devido/vencido/pago/a vencer. PURA — é a mesma usada pela aba
 * Financeiro do caso, para os dois lugares nunca mostrarem número diferente.
 *
 * Parcela CANCELADA não entra em nada (não é dívida nem recebimento); o status é
 * o EFETIVO (`statusEfetivoParcela`), porque "vencida" é uma consequência da data
 * e não fica gravada na linha.
 */
export function agregarParcelas(
  parcelas: Array<{
    status: string;
    data_vencimento: string;
    valor_centavos: number | string;
    valor_pago_centavos?: number | string | null;
  }>,
): ResumoValores {
  const r = ZERO();
  for (const p of parcelas) {
    const status = statusEfetivoParcela({ status: p.status, data_vencimento: p.data_vencimento });
    if (status === "CANCELADA") continue;
    const valor = Number(p.valor_centavos);
    r.devido_centavos += valor;
    if (status === "PAGA") r.pago_centavos += Number(p.valor_pago_centavos ?? valor);
    else if (status === "VENCIDA") r.vencido_centavos += valor;
    else r.vincendo_centavos += valor;
  }
  return r;
}

export async function getClientOverview(clientId: string): Promise<ClientOverview> {
  const sb = getSupabaseAdmin();

  // 1 — os casos do cliente, com as três etapas.
  const { data: casosRaw, error } = await sb
    .from("system_cases_active")
    .select(
      "id, case_code, caso_pasta_nome, tema_id, lifecycle, macrostatus_op, macrostatus_fin, macrostatus_comercial, service_type_id",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const casos = (casosRaw ?? []) as unknown as Array<{
    id: string;
    case_code: string | null;
    caso_pasta_nome: string | null;
    tema_id: string | null;
    lifecycle: string | null;
    macrostatus_op: string | null;
    macrostatus_fin: string | null;
    macrostatus_comercial: string | null;
    service_type_id: string | null;
  }>;

  if (!casos.length) {
    return { casos: [], totalReceitas: ZERO(), totalDespesas: ZERO() };
  }

  const caseIds = casos.map((c) => c.id);

  // 2 — as etapas configuradas, para traduzir o slug em rótulo humano. Uma
  // consulta para todos os tipos envolvidos; sem isto, a ficha mostraria o slug
  // cru (foi exatamente o bug 3 que o Thiago apontou em 04/09).
  const serviceTypeIds = [...new Set(casos.map((c) => c.service_type_id).filter(Boolean))];
  const rotulos = new Map<string, string>();
  if (serviceTypeIds.length) {
    const { data: etapas } = await sb
      .from("system_pipeline_stages_active")
      .select("slug, label")
      .in("service_type_id", serviceTypeIds as string[]);
    for (const e of (etapas ?? []) as Array<{ slug: string; label: string | null }>) {
      if (e.label) rotulos.set(e.slug, e.label);
    }
  }

  // 3 — todos os lançamentos dos casos, de uma vez.
  const { data: entriesRaw } = await sb
    .from("system_case_fin_entries")
    .select("id, case_id, kind, status")
    .in("case_id", caseIds)
    .is("deleted_at", null);
  const entries = (entriesRaw ?? []) as Array<{
    id: string;
    case_id: string;
    kind: string;
    status: string | null;
  }>;

  // Lançamento DISPENSADO não entra em conta — mesma regra da aba do caso.
  const validas = entries.filter((e) => e.status !== "DISPENSADO");

  // 4 — todas as parcelas desses lançamentos, de uma vez.
  const porEntry = new Map(validas.map((e) => [e.id, e]));
  const parcelasPorCaso = new Map<string, { receitas: typeof lista; despesas: typeof lista }>();
  type Parcela = {
    status: string;
    data_vencimento: string;
    valor_centavos: number | string;
    valor_pago_centavos: number | string | null;
  };
  const lista: Parcela[] = [];

  if (validas.length) {
    const { data: parcelasRaw } = await sb
      .from("system_case_fin_installments")
      .select("entry_id, status, data_vencimento, valor_centavos, valor_pago_centavos")
      .in(
        "entry_id",
        validas.map((e) => e.id),
      );

    for (const p of (parcelasRaw ?? []) as Array<Parcela & { entry_id: string }>) {
      const entry = porEntry.get(p.entry_id);
      if (!entry) continue;
      const balde = parcelasPorCaso.get(entry.case_id) ?? { receitas: [], despesas: [] };
      (entry.kind === "DESPESA" ? balde.despesas : balde.receitas).push(p);
      parcelasPorCaso.set(entry.case_id, balde);
    }
  }

  // 5 — nome dos temas, para o card mostrar o tema e não um uuid.
  const temaIds = [...new Set(casos.map((c) => c.tema_id).filter(Boolean))] as string[];
  const temaNomes = new Map<string, string>();
  if (temaIds.length) {
    const { data: temas } = await sb.from("system_temas").select("id, name").in("id", temaIds);
    for (const t of (temas ?? []) as Array<{ id: string; name: string }>) {
      temaNomes.set(t.id, t.name);
    }
  }

  let totalReceitas = ZERO();
  let totalDespesas = ZERO();

  const resultado: CasoDoCliente[] = casos.map((c) => {
    const balde = parcelasPorCaso.get(c.id) ?? { receitas: [], despesas: [] };
    const receitas = agregarParcelas(balde.receitas);
    const despesas = agregarParcelas(balde.despesas);
    totalReceitas = soma(totalReceitas, receitas);
    totalDespesas = soma(totalDespesas, despesas);

    const traduz = (slug: string | null) => (slug ? (rotulos.get(slug) ?? slug) : null);

    return {
      id: c.id,
      case_code: c.case_code,
      caso_pasta_nome: c.caso_pasta_nome,
      tema_id: c.tema_id,
      tema_nome: c.tema_id ? (temaNomes.get(c.tema_id) ?? null) : null,
      lifecycle: c.lifecycle,
      etapa_operacional: traduz(c.macrostatus_op),
      etapa_financeira: traduz(c.macrostatus_fin),
      // O rastro comercial já vem na view — não precisa de consulta extra.
      etapa_comercial: traduz(c.macrostatus_comercial),
      receitas,
      despesas,
    };
  });

  return { casos: resultado, totalReceitas, totalDespesas };
}
