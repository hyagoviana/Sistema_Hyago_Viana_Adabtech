// Server-only — Termo de Acerto: calculadora (PRD §9.2, em CENTAVOS/inteiros)
// + snapshots imutáveis (S17a) + conferência segregada/aprovação híbrida/PDF (S17b).

import { createHash } from "node:crypto";

import { ensureCaseFolder } from "./case-documents-service";
import { createDocWithText, exportPdf } from "./google/docs";
import { uploadFile } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

// Defaults do PRD (calibrar com o Hyago depois)
export const TERMO_DEFAULTS = {
  percentual_honorarios: 15, // %
  valor_parcela_centavos: 50000, // R$ 500,00
  desconto_avista_pct: 10, // %
  resto_minimo_centavos: 10000, // R$ 100,00 (resto < isso incorpora à última parcela)
  faixa_auto_min_centavos: 100000, // R$ 1.000
  faixa_auto_max_centavos: 2000000, // R$ 20.000
};

export class TermoServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TermoServiceError";
  }
}

export type TermoCalcInput = {
  saldoAntesCentavos: number;
  saldoDepoisCentavos: number;
  parcelasPagasCentavos?: number;
  percentual?: number;
  valorParcelaCentavos?: number;
  descontoAvistaPct?: number;
};

export type TermoCalcResult = {
  valor_efetivo_centavos: number;
  valor_total_centavos: number;
  qtd_parcelas: number;
  valor_parcela_centavos: number;
  valor_ultima_parcela_centavos: number;
  valor_avista_centavos: number;
  percentual_honorarios: number;
  desconto_avista_pct: number;
};

// Regra PRD §9.2 — truncamento (floor), nunca arredondamento.
export function calcularTermo(input: TermoCalcInput): TermoCalcResult {
  const percentual = input.percentual ?? TERMO_DEFAULTS.percentual_honorarios;
  const valorParcela = input.valorParcelaCentavos ?? TERMO_DEFAULTS.valor_parcela_centavos;
  const descontoAvista = input.descontoAvistaPct ?? TERMO_DEFAULTS.desconto_avista_pct;
  const parcelasPagas = input.parcelasPagasCentavos ?? 0;

  const efetivo = Math.max(
    0,
    input.saldoAntesCentavos - input.saldoDepoisCentavos - parcelasPagas,
  );
  const total = Math.floor((efetivo * percentual) / 100);

  let qtd = Math.floor(total / valorParcela);
  const resto = total - qtd * valorParcela;
  let ultima = 0;

  if (total <= 0) {
    qtd = 0;
    ultima = 0;
  } else if (qtd === 0) {
    qtd = 1;
    ultima = total;
  } else if (resto === 0) {
    ultima = valorParcela;
  } else if (resto < TERMO_DEFAULTS.resto_minimo_centavos) {
    ultima = valorParcela + resto; // incorpora à última
  } else {
    qtd += 1;
    ultima = resto;
  }

  const avista = Math.floor((total * (100 - descontoAvista)) / 100);

  return {
    valor_efetivo_centavos: efetivo,
    valor_total_centavos: total,
    qtd_parcelas: qtd,
    valor_parcela_centavos: valorParcela,
    valor_ultima_parcela_centavos: ultima,
    valor_avista_centavos: avista,
    percentual_honorarios: percentual,
    desconto_avista_pct: descontoAvista,
  };
}

export async function listTermos(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_termo_snapshots")
    .select("*")
    .eq("case_id", caseId)
    .order("version", { ascending: false });
  if (error) throw new TermoServiceError(error.message, 500);
  return data ?? [];
}

export async function getTermo(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("system_termo_snapshots").select("*").eq("id", id).single();
  if (error || !data) throw new TermoServiceError("Termo não encontrado", 404);
  return data;
}

// Cria snapshot v(n+1) em RASCUNHO a partir do cálculo.
export async function createTermo(input: {
  caseId: string;
  saldoAntesCentavos: number;
  saldoDepoisCentavos: number;
  parcelasPagasCentavos?: number;
  percentual?: number;
  valorParcelaCentavos?: number;
  descontoAvistaPct?: number;
  formaPagamento?: "PARCELADO" | "A_VISTA";
  tipoTermo?: "PARCIAL" | "COMPLEMENTAR";
  elaboradoPorId?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const calc = calcularTermo(input);

  const { data: last } = await sb
    .from("system_termo_snapshots")
    .select("version")
    .eq("case_id", input.caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (last?.version ?? 0) + 1;

  const { data, error } = await sb
    .from("system_termo_snapshots")
    .insert({
      organization_id: DEFAULT_ORG,
      case_id: input.caseId,
      version,
      saldo_antes_centavos: input.saldoAntesCentavos,
      saldo_depois_centavos: input.saldoDepoisCentavos,
      parcelas_pagas_centavos: input.parcelasPagasCentavos ?? 0,
      valor_efetivo_centavos: calc.valor_efetivo_centavos,
      percentual_honorarios: calc.percentual_honorarios,
      valor_total_centavos: calc.valor_total_centavos,
      valor_parcela_centavos: calc.valor_parcela_centavos,
      qtd_parcelas: calc.qtd_parcelas,
      valor_ultima_parcela_centavos: calc.valor_ultima_parcela_centavos,
      desconto_avista_pct: calc.desconto_avista_pct,
      valor_avista_centavos: calc.valor_avista_centavos,
      forma_pagamento: input.formaPagamento ?? "PARCELADO",
      tipo_termo: input.tipoTermo ?? "PARCIAL",
      status: "RASCUNHO",
      elaborado_por_id: input.elaboradoPorId ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new TermoServiceError(error?.message ?? "Falha ao criar termo", 500);
  return data;
}

// --------------------------------------------------------------- S17b ----
function brl(c: number) {
  return "R$ " + (c / 100).toFixed(2).replace(".", ",");
}

// Aprovação híbrida — 7 critérios (PRD §11), recorte MVP nos principais.
function avaliarAuto(termo: {
  tipo_termo: string;
  percentual_honorarios: number;
  valor_total_centavos: number;
}) {
  const criterios = {
    tipo_parcial: termo.tipo_termo === "PARCIAL",
    percentual_padrao: Number(termo.percentual_honorarios) === TERMO_DEFAULTS.percentual_honorarios,
    valor_na_faixa:
      termo.valor_total_centavos >= TERMO_DEFAULTS.faixa_auto_min_centavos &&
      termo.valor_total_centavos <= TERMO_DEFAULTS.faixa_auto_max_centavos,
  };
  const auto = Object.values(criterios).every(Boolean);
  return { auto, criterios };
}

async function gerarPdfTermo(termo: Awaited<ReturnType<typeof getTermo>>) {
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("case_code, client_id")
    .eq("id", termo.case_id)
    .single();
  const { data: cli } = await sb
    .from("system_clients")
    .select("full_name, cpf_cnpj")
    .eq("id", caso?.client_id ?? "")
    .single();

  const text = [
    "TERMO DE ACERTO",
    "",
    `Cliente: ${cli?.full_name ?? "—"}`,
    `CPF/CNPJ: ${cli?.cpf_cnpj ?? "—"}`,
    `Caso: ${caso?.case_code ?? "—"} — Termo v${termo.version}`,
    "",
    `Saldo antes: ${brl(termo.saldo_antes_centavos)}`,
    `Saldo depois: ${brl(termo.saldo_depois_centavos)}`,
    `Parcelas pagas no processo: ${brl(termo.parcelas_pagas_centavos)}`,
    `Valor efetivo do abatimento: ${brl(termo.valor_efetivo_centavos)}`,
    "",
    `Honorários (${termo.percentual_honorarios}%): ${brl(termo.valor_total_centavos)}`,
    `Parcelamento: ${termo.qtd_parcelas}x de ${brl(termo.valor_parcela_centavos)} (última ${brl(termo.valor_ultima_parcela_centavos)})`,
    `À vista (${termo.desconto_avista_pct}% desc.): ${brl(termo.valor_avista_centavos)}`,
    "",
    `Tipo: ${termo.tipo_termo} · Forma: ${termo.forma_pagamento}`,
  ].join("\n");

  const docId = await createDocWithText(
    `Termo de Acerto ${caso?.case_code ?? ""} v${termo.version}`,
    text,
  );
  const pdf = await exportPdf(docId);
  const { folderId } = await ensureCaseFolder(termo.case_id);
  const file = await uploadFile({
    parentId: folderId,
    name: `Termo-${caso?.case_code ?? "caso"}-v${termo.version}.pdf`,
    mimeType: "application/pdf",
    body: pdf,
  });
  return { driveFileId: file.id, url: file.url, hash: createHash("sha256").update(pdf).digest("hex") };
}

async function finalizarAprovacao(
  termoId: string,
  aprovadoPorId: string | null,
  auto: boolean,
  criterios: unknown,
) {
  const sb = getSupabaseAdmin();
  const termo = await getTermo(termoId);
  const pdf = await gerarPdfTermo(termo);
  const { data, error } = await sb
    .from("system_termo_snapshots")
    .update({
      status: "APROVADO_JURIDICO",
      aprovado_por_id: aprovadoPorId,
      aprovacao_automatica: auto,
      criterios_aprovacao: criterios as never,
      drive_file_id: pdf.driveFileId,
      drive_url: pdf.url,
      pdf_hash_sha256: pdf.hash,
    })
    .eq("id", termoId)
    .select()
    .single();
  if (error || !data) throw new TermoServiceError(error?.message ?? "Falha ao aprovar", 500);
  return data;
}

export async function enviarParaConferencia(termoId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_termo_snapshots")
    .update({ status: "EM_CONFERENCIA" })
    .eq("id", termoId)
    .eq("status", "RASCUNHO")
    .select()
    .single();
  if (error || !data) throw new TermoServiceError("Só é possível enviar um rascunho para conferência", 409);
  return data;
}

// Conferência segregada + aprovação híbrida (G-06 / B6).
export async function conferirTermo(termoId: string, conferidoPorId: string) {
  const sb = getSupabaseAdmin();
  const termo = await getTermo(termoId);
  if (termo.elaborado_por_id && termo.elaborado_por_id === conferidoPorId) {
    throw new TermoServiceError("Quem elaborou o termo não pode conferir (segregação)", 403);
  }
  // Grava conferidor (o CHECK do banco reforça a segregação).
  const { error: cErr } = await sb
    .from("system_termo_snapshots")
    .update({ conferido_por_id: conferidoPorId })
    .eq("id", termoId);
  if (cErr) throw new TermoServiceError(cErr.message, 500);

  const { auto, criterios } = avaliarAuto(termo);
  if (auto) {
    return { termo: await finalizarAprovacao(termoId, conferidoPorId, true, criterios), auto: true, criterios };
  }
  const { data } = await sb
    .from("system_termo_snapshots")
    .update({ status: "APROVACAO_JURIDICA" })
    .eq("id", termoId)
    .select()
    .single();
  return { termo: data, auto: false, criterios };
}

export async function aprovarTermoManual(termoId: string, aprovadoPorId: string) {
  return finalizarAprovacao(termoId, aprovadoPorId, false, { manual: true });
}
