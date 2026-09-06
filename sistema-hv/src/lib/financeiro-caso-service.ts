// Server-only — FN1 (2026-08-26) — FINANCEIRO DO CASO (doc "25.08 _ Financeiro SHV").
//
// O registro nasce AQUI e o lançamento no Conta Azul é um passo separado (FN2).
// Thiago: "também defini a possibilidade de que valores sejam registrados no SHV,
// sem necessariamente serem lançados no Conta Azul (…) em razão de uma
// especificidade da advocacia: parte dos valores são questões futuras".
//
// NUNCA importe este arquivo no browser (usa service_role).

import { agregarParcelas } from "./client-overview-service";
import { getSupabaseAdmin } from "./supabase/server";
import {
  dividirEmParcelas,
  somarMeses,
  statusEfetivoParcela,
  type FinKind,
} from "./financeiro-caso-shared";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class FinanceiroCasoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FinanceiroCasoError";
  }
}

// ---------------------------------------------------------------------------
// Categorias (a árvore do Conta Azul)
// ---------------------------------------------------------------------------
export interface FinCategoria {
  id: string;
  kind: string;
  codigo: string;
  nome: string;
  parent_id: string | null;
  reembolsavel: boolean;
  /** Caminho legível: "Fiscal › Honorários contratuais › Entrada". */
  caminho: string;
  /** Só as folhas são selecionáveis — é nelas que o Conta Azul lança. */
  folha: boolean;
  /** FN2 — id da categoria correspondente no Conta Azul (null = ainda não amarrada). */
  contaazul_id: string | null;
}

export async function listCategorias(kind?: FinKind | null): Promise<FinCategoria[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_fin_categorias")
    .select("id, kind, codigo, nome, parent_id, reembolsavel, contaazul_id")
    .eq("organization_id", DEFAULT_ORG)
    .eq("active", true)
    .is("deleted_at", null)
    .order("codigo", { ascending: true });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw new FinanceiroCasoError(error.message, 500);

  const linhas = data ?? [];
  const porId = new Map(linhas.map((c) => [c.id as string, c]));
  const temFilho = new Set(
    linhas.map((c) => c.parent_id as string | null).filter((v): v is string => !!v),
  );

  return linhas.map((c) => {
    // Caminho: sobe pelos pais. A árvore tem 3 níveis, então o laço é curto.
    const partes: string[] = [c.nome as string];
    let pai = c.parent_id ? porId.get(c.parent_id as string) : undefined;
    let guarda = 0;
    while (pai && guarda++ < 5) {
      partes.unshift(pai.nome as string);
      pai = pai.parent_id ? porId.get(pai.parent_id as string) : undefined;
    }
    return {
      id: c.id as string,
      kind: c.kind as string,
      codigo: c.codigo as string,
      nome: c.nome as string,
      parent_id: (c.parent_id as string) ?? null,
      reembolsavel: c.reembolsavel === true,
      caminho: partes.join(" › "),
      folha: !temFilho.has(c.id as string),
      // Sem este campo a tela de Integrações mostrava "0 de 13" mesmo com os
      // vínculos gravados: ela não tinha como saber que existiam.
      contaazul_id: ((c as { contaazul_id?: string | null }).contaazul_id ?? null) as string | null,
    };
  });
}

// ---------------------------------------------------------------------------
// Lançamentos do caso
// ---------------------------------------------------------------------------
export interface FinParcela {
  id: string;
  numero: number;
  data_vencimento: string;
  valor_centavos: number;
  status: string;
  valor_pago_centavos: number | null;
  data_pagamento: string | null;
}

export interface FinEntry {
  id: string;
  case_id: string;
  kind: string;
  tipo: string;
  categoria_id: string | null;
  categoria_caminho: string | null;
  status: string;
  descricao: string | null;
  valor_centavos: number;
  forma_pagamento: string | null;
  conta_financeira: string | null;
  data_vencimento: string | null;
  parcelas: number;
  periodicidade_meses: number;
  fornecedor: string | null;
  recorrente: boolean;
  reembolsavel: boolean;
  origem_despesa_id: string | null;
  contaazul_registro_id: string | null;
  contaazul_sync_error: string | null;
  created_at: string;
  installments: FinParcela[];
}

export async function listCaseFinEntries(caseId: string): Promise<FinEntry[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_fin_entries")
    .select("*")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new FinanceiroCasoError(error.message, 500);

  const entries = data ?? [];
  if (entries.length === 0) return [];

  const { data: parcelas } = await sb
    .from("system_case_fin_installments")
    .select("*")
    .in(
      "entry_id",
      entries.map((e) => e.id as string),
    )
    .order("numero", { ascending: true });

  const categorias = await listCategorias();
  const caminhoPorId = new Map(categorias.map((c) => [c.id, c.caminho]));

  return entries.map((e) => ({
    ...(e as unknown as FinEntry),
    categoria_caminho: e.categoria_id ? (caminhoPorId.get(e.categoria_id as string) ?? null) : null,
    installments: (parcelas ?? [])
      .filter((p) => p.entry_id === e.id)
      .map((p) => ({
        id: p.id as string,
        numero: p.numero as number,
        data_vencimento: p.data_vencimento as string,
        valor_centavos: Number(p.valor_centavos),
        status: statusEfetivoParcela(p as { status: string; data_vencimento: string }),
        valor_pago_centavos: p.valor_pago_centavos == null ? null : Number(p.valor_pago_centavos),
        data_pagamento: (p.data_pagamento as string) ?? null,
      })),
  }));
}

export interface CriarEntryInput {
  caseId: string;
  kind: FinKind;
  tipo: string;
  categoriaId?: string | null;
  descricao?: string | null;
  valorCentavos: number;
  formaPagamento?: string | null;
  contaFinanceira?: string | null;
  dataVencimento?: string | null;
  parcelas?: number;
  periodicidadeMeses?: number;
  fornecedor?: string | null;
  recorrente?: boolean;
  reembolsavel?: boolean;
  /** Parcelas revisadas pelo usuário (Desenho 4: "Revisar parcelas"). */
  parcelasCustomizadas?: Array<{ numero: number; data_vencimento: string; valor_centavos: number }>;
}

/**
 * Cria o lançamento + suas parcelas.
 *
 * Regra do doc que NÃO é óbvia: despesa marcada como **reembolsável** gera
 * automaticamente uma RECEITA pendente com as mesmas informações — "quando a
 * despesa for criada com essa anotação, o sistema automaticamente gera uma
 * receita pendente com as mesmas informações (não lançada)".
 */
export async function criarEntry(
  input: CriarEntryInput,
  userId?: string,
): Promise<{ id: string; receitaEspelhoId: string | null }> {
  const sb = getSupabaseAdmin();

  if (!Number.isFinite(input.valorCentavos) || input.valorCentavos < 0) {
    throw new FinanceiroCasoError("Informe um valor válido", 422);
  }

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id")
    .eq("id", input.caseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!caso) throw new FinanceiroCasoError("Caso não encontrado", 404);

  const nParcelas = Math.max(1, Math.min(input.parcelas ?? 1, 240));
  const org = (caso.organization_id as string) ?? DEFAULT_ORG;

  const { data: criado, error } = await sb
    .from("system_case_fin_entries")
    .insert({
      organization_id: org,
      case_id: input.caseId,
      kind: input.kind,
      tipo: input.tipo,
      categoria_id: input.categoriaId ?? null,
      descricao: input.descricao ?? null,
      valor_centavos: input.valorCentavos,
      forma_pagamento: input.formaPagamento ?? null,
      conta_financeira: input.contaFinanceira ?? null,
      data_vencimento: input.dataVencimento ?? null,
      parcelas: nParcelas,
      periodicidade_meses: Math.max(1, Math.min(input.periodicidadeMeses ?? 1, 12)),
      fornecedor: input.fornecedor ?? null,
      recorrente: input.recorrente ?? false,
      reembolsavel: input.reembolsavel ?? false,
      created_by: userId ?? null,
    })
    .select("id")
    .single();
  if (error || !criado) throw new FinanceiroCasoError(error?.message ?? "Falha ao registrar", 500);

  await gerarParcelas(criado.id as string, org, input, nParcelas);

  // Despesa reembolsável → receita pendente espelhada.
  let receitaEspelhoId: string | null = null;
  if (input.kind === "DESPESA" && input.reembolsavel) {
    receitaEspelhoId = await criarReceitaDeReembolso(
      criado.id as string,
      org,
      input,
      nParcelas,
      userId,
    );
  }

  return { id: criado.id as string, receitaEspelhoId };
}

/** Gera as parcelas — respeitando a revisão manual, quando houver. */
async function gerarParcelas(
  entryId: string,
  org: string,
  input: CriarEntryInput,
  nParcelas: number,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const base = input.dataVencimento ?? new Date().toISOString().slice(0, 10);
  const periodicidade = Math.max(1, Math.min(input.periodicidadeMeses ?? 1, 12));

  const linhas =
    input.parcelasCustomizadas && input.parcelasCustomizadas.length === nParcelas
      ? input.parcelasCustomizadas.map((p) => ({
          organization_id: org,
          entry_id: entryId,
          numero: p.numero,
          data_vencimento: p.data_vencimento,
          valor_centavos: p.valor_centavos,
        }))
      : dividirEmParcelas(input.valorCentavos, nParcelas).map((valor, i) => ({
          organization_id: org,
          entry_id: entryId,
          numero: i + 1,
          data_vencimento: somarMeses(base, i * periodicidade),
          valor_centavos: valor,
        }));

  const { error } = await sb.from("system_case_fin_installments").insert(linhas);
  if (error) throw new FinanceiroCasoError(error.message, 500);
}

/** A receita pendente que nasce de uma despesa reembolsável. */
async function criarReceitaDeReembolso(
  despesaId: string,
  org: string,
  input: CriarEntryInput,
  nParcelas: number,
  userId?: string,
): Promise<string> {
  const sb = getSupabaseAdmin();
  // De-para do doc: o tipo da receita segue o tipo da despesa que a originou.
  const tipoReceita =
    input.tipo === "CUSTAS_TAXAS_EMOLUMENTOS" ? "REEMBOLSO_CUSTAS" : "REEMBOLSO_DILIGENCIAS";

  const { data, error } = await sb
    .from("system_case_fin_entries")
    .insert({
      organization_id: org,
      case_id: input.caseId,
      kind: "RECEITA",
      tipo: tipoReceita,
      status: "AGUARDANDO",
      descricao: `Reembolso de: ${input.descricao ?? ""}`.trim(),
      valor_centavos: input.valorCentavos,
      data_vencimento: input.dataVencimento ?? null,
      parcelas: 1,
      origem_despesa_id: despesaId,
      created_by: userId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new FinanceiroCasoError(error?.message ?? "Falha no reembolso", 500);

  await sb.from("system_case_fin_installments").insert({
    organization_id: org,
    entry_id: data.id as string,
    numero: 1,
    data_vencimento: input.dataVencimento ?? new Date().toISOString().slice(0, 10),
    valor_centavos: input.valorCentavos,
  });

  return data.id as string;
}

export async function setEntryStatus(entryId: string, status: string): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_case_fin_entries")
    .update({ status })
    .eq("id", entryId)
    .is("deleted_at", null);
  if (error) throw new FinanceiroCasoError(error.message, 500);
  return { ok: true };
}

export async function excluirEntry(entryId: string): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  // Não deixa apagar o que já foi ao ERP sem passar pela revisão (FN2).
  const { data: atual } = await sb
    .from("system_case_fin_entries")
    .select("status")
    .eq("id", entryId)
    .maybeSingle();
  if ((atual as { status?: string } | null)?.status === "LANCADO") {
    throw new FinanceiroCasoError(
      "Este lançamento já existe no Conta Azul. Use “Revisar lançamento” antes de excluir.",
      409,
    );
  }
  const { error } = await sb
    .from("system_case_fin_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", entryId);
  if (error) throw new FinanceiroCasoError(error.message, 500);
  return { ok: true };
}

/** Edita UMA parcela (o "Revisar parcelas" do Desenho 4, depois de criado). */
export async function atualizarParcela(
  parcelaId: string,
  patch: { data_vencimento?: string; valor_centavos?: number; status?: string },
): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const clean: Record<string, unknown> = {};
  if (patch.data_vencimento) clean.data_vencimento = patch.data_vencimento;
  if (patch.valor_centavos != null) clean.valor_centavos = patch.valor_centavos;
  if (patch.status) clean.status = patch.status;
  if (Object.keys(clean).length === 0) return { ok: true };

  const { error } = await sb
    .from("system_case_fin_installments")
    .update(clean as never)
    .eq("id", parcelaId);
  if (error) throw new FinanceiroCasoError(error.message, 500);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Painel "Valores lançados" (Desenho 2/3)
// ---------------------------------------------------------------------------
export interface ResumoPorTipo {
  kind: string;
  tipo: string;
  devido_centavos: number;
  vencido_centavos: number;
  recebido_centavos: number;
  vincendo_centavos: number;
}

/**
 * Devido / Vencido / Recebido / Vincendo por tipo — exatamente os quatro números
 * que o Desenho 2 pede ("Entrada: Valor Devido = x / Valor vencido = X / Valor
 * recebido = X / Valor vincendo = X").
 */
export async function resumoFinanceiroCaso(caseId: string): Promise<ResumoPorTipo[]> {
  const entries = await listCaseFinEntries(caseId);
  const porChave = new Map<string, ResumoPorTipo>();

  for (const e of entries) {
    if (e.status === "DISPENSADO") continue; // dispensado não entra em conta
    const chave = `${e.kind}:${e.tipo}`;
    const atual = porChave.get(chave) ?? {
      kind: e.kind,
      tipo: e.tipo,
      devido_centavos: 0,
      vencido_centavos: 0,
      recebido_centavos: 0,
      vincendo_centavos: 0,
    };

    // S3-04 — a régua é uma só, compartilhada com a ficha do cliente
    // (`agregarParcelas`). Antes esta contagem estava escrita aqui e a ficha
    // teria que repeti-la; duas cópias divergiriam no primeiro ajuste e os dois
    // lugares passariam a mostrar números diferentes para o mesmo caso.
    const r = agregarParcelas(e.installments);
    atual.devido_centavos += r.devido_centavos;
    atual.recebido_centavos += r.pago_centavos;
    atual.vencido_centavos += r.vencido_centavos;
    atual.vincendo_centavos += r.vincendo_centavos;
    porChave.set(chave, atual);
  }

  return [...porChave.values()];
}

// ---------------------------------------------------------------------------
// Tema → Conta Azul (Desenho 6)
// ---------------------------------------------------------------------------
export async function setTemaContaAzul(
  temaId: string,
  patch: {
    centroCustoId?: string | null;
    centroCustoNome?: string | null;
    servicoId?: string | null;
    servicoNome?: string | null;
  },
): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_temas")
    .update({
      contaazul_centro_custo_id: patch.centroCustoId ?? null,
      contaazul_centro_custo_nome: patch.centroCustoNome ?? null,
      contaazul_servico_id: patch.servicoId ?? null,
      contaazul_servico_nome: patch.servicoNome ?? null,
    } as never)
    .eq("id", temaId);
  if (error) throw new FinanceiroCasoError(error.message, 500);
  return { ok: true };
}
