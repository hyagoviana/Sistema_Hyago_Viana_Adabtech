// Server-only — Termo de Acerto: calculadora (PRD §9.2, em CENTAVOS/inteiros)
// + snapshots imutáveis (S17a) + conferência segregada/aprovação híbrida/PDF (S17b).

import { createHash } from "node:crypto";

import {
  ensureCaseFolder,
  generateCaseDocumentFromTemplate,
} from "./case-documents-service";
import { createDocWithText, docUrl, exportPdf } from "./google/docs";
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

  const efetivo = Math.max(0, input.saldoAntesCentavos - input.saldoDepoisCentavos - parcelasPagas);
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

// S7-02 — honorários persistidos da procuração (S7-01), para pré-preencher a
// elaboração do termo. Retorna null quando o caso não tem registro (cai nos
// defaults no front).
export async function getCaseHonorarios(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_honorarios_active")
    .select(
      "percentual_honorarios, valor_parcela_centavos, desconto_avista_pct, forma_pagamento, honorarios_total_centavos",
    )
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) throw new TermoServiceError(error.message, 500);
  return data ?? null;
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
  // S7-02 — remanescente anterior (só COMPLEMENTAR). Persistido no snapshot para
  // o documento e para somar em honorarios_total.
  remanescenteAnteriorCentavos?: number | null;
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
      // Só COMPLEMENTAR usa remanescente; nos demais fica null.
      remanescente_anterior_centavos:
        (input.tipoTermo ?? "PARCIAL") === "COMPLEMENTAR"
          ? (input.remanescenteAnteriorCentavos ?? null)
          : null,
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
  return {
    driveFileId: file.id,
    url: file.url,
    hash: createHash("sha256").update(pdf).digest("hex"),
  };
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
  if (error || !data)
    throw new TermoServiceError("Só é possível enviar um rascunho para conferência", 409);
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
    return {
      termo: await finalizarAprovacao(termoId, conferidoPorId, true, criterios),
      auto: true,
      criterios,
    };
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

export async function apresentarTermo(termoId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_termo_snapshots")
    .update({ status: "APRESENTADO" })
    .eq("id", termoId)
    .eq("status", "APROVADO_JURIDICO")
    .select()
    .single();
  if (error || !data) throw new TermoServiceError("Só um termo aprovado pode ser apresentado", 409);
  return data;
}

// Recusa do cliente (S20-4) — APRESENTADO → RECUSADO. NÃO gera parcelas.
export async function recusarTermo(termoId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_termo_snapshots")
    .update({ status: "RECUSADO" })
    .eq("id", termoId)
    .eq("status", "APRESENTADO")
    .select()
    .single();
  if (error || !data) {
    throw new TermoServiceError("Só um termo apresentado pode ser recusado", 409);
  }
  return data;
}

// Aceite do cliente → gera parcelas e ativa a cobrança (caso vai a ATIVO).
export async function aceitarTermo(termoId: string) {
  const sb = getSupabaseAdmin();
  const termo = await getTermo(termoId);
  if (termo.status !== "APRESENTADO") {
    throw new TermoServiceError("O termo precisa estar apresentado para ser aceito", 409);
  }

  const { error: upErr } = await sb
    .from("system_termo_snapshots")
    .update({ status: "ACEITO" })
    .eq("id", termoId);
  if (upErr) throw new TermoServiceError(upErr.message, 500);

  // Gera parcelas (idempotente via UNIQUE(termo_id, numero)).
  const base = new Date();
  const rows: Array<{
    organization_id: string;
    case_id: string;
    termo_id: string;
    numero: number;
    valor_centavos: number;
    vencimento: string;
  }> = [];

  if (termo.forma_pagamento === "A_VISTA") {
    // À vista: 1 única parcela com o valor já descontado, vencendo em ~7 dias.
    const venc = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
    rows.push({
      organization_id: termo.organization_id,
      case_id: termo.case_id,
      termo_id: termo.id,
      numero: 1,
      valor_centavos: termo.valor_avista_centavos,
      vencimento: venc.toISOString().slice(0, 10),
    });
  } else {
    for (let i = 1; i <= termo.qtd_parcelas; i++) {
      const isLast = i === termo.qtd_parcelas;
      const valor = isLast ? termo.valor_ultima_parcela_centavos : termo.valor_parcela_centavos;
      const venc = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
      rows.push({
        organization_id: termo.organization_id,
        case_id: termo.case_id,
        termo_id: termo.id,
        numero: i,
        valor_centavos: valor,
        vencimento: venc.toISOString().slice(0, 10),
      });
    }
  }

  if (rows.length > 0) {
    const { error: pErr } = await sb.from("system_parcelas").upsert(rows, {
      onConflict: "termo_id,numero",
      ignoreDuplicates: true,
    });
    if (pErr) throw new TermoServiceError(`Falha ao gerar parcelas: ${pErr.message}`, 500);
  }

  // Move o caso para ATIVO (cobrança ativa).
  await sb.from("system_cases").update({ macrostatus_fin: "ATIVO" }).eq("id", termo.case_id);

  // Conta real de parcelas geradas (À VISTA = 1; PARCELADO = N).
  return { ok: true as const, parcelas: rows.length };
}

export async function listParcelas(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_parcelas_active")
    .select("*")
    .eq("case_id", caseId)
    .order("numero", { ascending: true });
  if (error) throw new TermoServiceError(error.message, 500);
  return data ?? [];
}

// Baixa manual de parcela (S22) — substituto provisório da cobrança via n8n.
// Idempotente: só dá baixa se a parcela ainda não está PAGA (senão 409).
export async function darBaixaParcela(
  parcelaId: string,
  input: {
    valorPagoCentavos: number;
    dataPagamento?: string | null;
    metodoPagamento?: string | null;
  },
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_parcelas")
    .update({
      status: "PAGA",
      valor_pago_centavos: input.valorPagoCentavos,
      data_pagamento: input.dataPagamento ?? new Date().toISOString(),
      metodo_pagamento: input.metodoPagamento ?? null,
    })
    .eq("id", parcelaId)
    .neq("status", "PAGA")
    .select()
    .single();
  if (error || !data) {
    throw new TermoServiceError("Parcela já paga ou não encontrada", 409);
  }
  await sb.from("system_audit_log").insert({
    organization_id: data.organization_id,
    action: "parcela.baixa",
    entity_type: "parcela",
    entity_id: parcelaId,
    diff: { valor_pago_centavos: input.valorPagoCentavos, metodo: input.metodoPagamento ?? null },
  });
  return data;
}

// Estorno da baixa (reverte PAGA → PENDENTE). Idempotente (só sobre PAGA).
export async function estornarParcela(parcelaId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_parcelas")
    .update({
      status: "PENDENTE",
      valor_pago_centavos: null,
      data_pagamento: null,
      metodo_pagamento: null,
    })
    .eq("id", parcelaId)
    .eq("status", "PAGA")
    .select()
    .single();
  if (error || !data) {
    throw new TermoServiceError("Só uma parcela paga pode ser estornada", 409);
  }
  await sb.from("system_audit_log").insert({
    organization_id: data.organization_id,
    action: "parcela.estorno",
    entity_type: "parcela",
    entity_id: parcelaId,
  });
  return data;
}

// ------------------------------------------------------------------ S6-04 ----
// Geração do DOCUMENTO editável do termo (2 opções: parcelado + à vista num
// único doc, por tipo_termo) via generateCaseDocumentFromTemplate. Grava o link
// editável (google_doc) em system_termo_snapshots.drive_url do RASCUNHO vigente.
// Sem migration: usa colunas já existentes; UPDATE só sobre RASCUNHO (mutável).

// Por-extenso simples (inteiros; usado só nos principais valores). Para reais
// arredonda p/ o inteiro mais próximo — o valor exato em número já vai no doc.
const _UNI = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
  "dezoito", "dezenove",
];
const _DEZ = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
];
const _CEM = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
  "setecentos", "oitocentos", "novecentos",
];

function _ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c > 0) parts.push(_CEM[c]);
  if (r > 0) {
    if (r < 20) parts.push(_UNI[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u > 0 ? `${_DEZ[d]} e ${_UNI[u]}` : _DEZ[d]);
    }
  }
  return parts.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (milhoes > 0)
    parts.push(`${_ate999(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  if (milhares > 0) parts.push(`${milhares === 1 ? "mil" : `${_ate999(milhares)} mil`}`);
  if (resto > 0) parts.push(_ate999(resto));
  return parts.join(", ").replace(/,([^,]*)$/, " e$1").trim() || "zero";
}

// Reais por extenso (arredonda centavos ao real). Ex.: 150000 → "mil e quinhentos reais".
export function reaisPorExtenso(centavos: number): string {
  const reais = Math.round((centavos ?? 0) / 100);
  return `${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`;
}

function brlDoc(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}

// Convenção de nome do modelo por tipo_termo. O modelo Google Doc deve ter, no
// NOME, "TERMO ACERTO PARCIAL" ou "TERMO ACERTO COMPLEMENTAR" (case-insensitive,
// acentos/hífen ignorados). Ajustar aqui se o owner mudar a convenção.
function templateNameMatches(name: string, tipo: "PARCIAL" | "COMPLEMENTAR"): boolean {
  const norm = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  return norm.includes("TERMO") && norm.includes("ACERTO") && norm.includes(tipo);
}

async function resolveTermoTemplateId(tipo: "PARCIAL" | "COMPLEMENTAR"): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_document_templates")
    .select("id, name")
    .is("deleted_at", null)
    .eq("active", true);
  if (error) throw new TermoServiceError(error.message, 500);
  const match = (data ?? []).find((t) => templateNameMatches(t.name, tipo));
  if (!match) {
    // Degrada com mensagem clara (não quebra): setup dos 2 Google Docs pendente.
    throw new TermoServiceError(
      `Modelo de termo não configurado (${tipo}). Cadastre o modelo "TERMO ACERTO ${tipo}" na pasta de modelos e rode "Sincronizar modelos".`,
      424,
    );
  }
  return match.id;
}

// Data por extenso em pt-BR (ex.: "3 de julho de 2026").
function dataPorExtenso(d = new Date()): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

// Inputs OPCIONAIS coletados na tela elaborar para placeholders SEM fonte no
// cálculo (S7-02). Ausentes → string vazia (NUNCA deixar o <placeholder> literal).
export type TermoDocExtras = {
  remanescenteAnteriorCentavos?: number | null; // COMPLEMENTAR
  saldoAtualCentavos?: number | null; // PARCIAL
  percentualAbatimento?: number | null; // PARCIAL (%)
  saldoOriginarioCentavos?: number | null; // COMPLEMENTAR
  saldoEpocaAbatimentoCentavos?: number | null; // COMPLEMENTAR
};

// Monta TODOS os placeholders <campo> dos 2 modelos (PARCIAL/COMPLEMENTAR) a
// partir do snapshot + cadastro + inputs opcionais. Reconciliação S7-02:
//   - COMPLEMENTAR: honorarios_total = valor_total (abatimento) + remanescente;
//     honorarios_abatimento = só o abatimento novo; remanescente_anterior = o
//     remanescente digitado.
//   - PARCIAL: honorarios_total = honorarios_abatimento = valor_total.
// Placeholders sem fonte no cálculo (saldo_atual, percentual_abatimento,
// saldo_originario, saldo_epoca_abatimento) vêm dos inputs opcionais; se não
// vierem, saem como string vazia — nunca o token literal.
function buildTermoValues(
  termo: Awaited<ReturnType<typeof getTermo>>,
  cliente: { full_name: string | null; cpf_cnpj: string | null },
  tipoServico: string | null,
  extras: TermoDocExtras = {},
): Record<string, string> {
  const isComplementar = termo.tipo_termo === "COMPLEMENTAR";
  // Remanescente: prioriza o input desta geração; senão o persistido no snapshot.
  const remanescenteCentavos = isComplementar
    ? (extras.remanescenteAnteriorCentavos ?? termo.remanescente_anterior_centavos ?? 0)
    : 0;
  const honorariosTotalCentavos = termo.valor_total_centavos + remanescenteCentavos;

  const optBrl = (c: number | null | undefined) => (c == null ? "" : brlDoc(c));
  const optPct = (n: number | null | undefined) => (n == null ? "" : `${n}%`);

  const values: Record<string, string> = {
    // ── Comuns aos 2 modelos ──────────────────────────────────────────────
    nome_cliente: cliente.full_name ?? "",
    cpf_cliente: cliente.cpf_cnpj ?? "",
    tipo_servico: tipoServico ?? "",
    saldo_antes: brlDoc(termo.saldo_antes_centavos),
    saldo_depois: brlDoc(termo.saldo_depois_centavos),
    parcelas_pagas: brlDoc(termo.parcelas_pagas_centavos),
    valor_abatimento: brlDoc(termo.valor_efetivo_centavos),
    percentual_honorarios: `${termo.percentual_honorarios}%`,
    honorarios_total: brlDoc(honorariosTotalCentavos),
    honorarios_total_extenso: reaisPorExtenso(honorariosTotalCentavos),
    qtd_parcelas: String(termo.qtd_parcelas),
    valor_parcela: brlDoc(termo.valor_parcela_centavos),
    valor_ultima_parcela: brlDoc(termo.valor_ultima_parcela_centavos),
    desconto_avista: `${termo.desconto_avista_pct}%`,
    valor_avista: brlDoc(termo.valor_avista_centavos),
    valor_avista_extenso: reaisPorExtenso(termo.valor_avista_centavos),
    data_extenso: dataPorExtenso(),

    // ── Só PARCIAL ────────────────────────────────────────────────────────
    // saldo_atual / percentual_abatimento: sem fonte no cálculo → input opcional.
    saldo_atual: optBrl(extras.saldoAtualCentavos),
    percentual_abatimento: optPct(extras.percentualAbatimento),
    valor_ultima_parcela_extenso: reaisPorExtenso(termo.valor_ultima_parcela_centavos),

    // ── Só COMPLEMENTAR ───────────────────────────────────────────────────
    // honorarios_abatimento = só o abatimento novo (valor_total do cálculo).
    honorarios_abatimento: brlDoc(termo.valor_total_centavos),
    // remanescente_anterior = valor digitado (0 fora do COMPLEMENTAR → vazio).
    remanescente_anterior: isComplementar ? brlDoc(remanescenteCentavos) : "",
    // saldo_originario / saldo_epoca_abatimento: sem fonte → input opcional.
    saldo_originario: optBrl(extras.saldoOriginarioCentavos),
    saldo_epoca_abatimento: optBrl(extras.saldoEpocaAbatimentoCentavos),
  };
  return values;
}

export async function gerarDocumentoTermo(input: {
  termoId: string;
  remanescenteAnteriorCentavos?: number;
  // S7-02 — inputs opcionais p/ placeholders sem fonte no cálculo.
  saldoAtualCentavos?: number;
  percentualAbatimento?: number;
  saldoOriginarioCentavos?: number;
  saldoEpocaAbatimentoCentavos?: number;
  triggeredBy?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const termo = await getTermo(input.termoId);

  // Imutabilidade: só gera/grava sobre RASCUNHO (o restante é travado por trigger).
  if (termo.status !== "RASCUNHO") {
    throw new TermoServiceError(
      "Só é possível gerar o documento a partir de um termo em RASCUNHO",
      409,
    );
  }

  const tipo = (termo.tipo_termo === "COMPLEMENTAR" ? "COMPLEMENTAR" : "PARCIAL") as
    | "PARCIAL"
    | "COMPLEMENTAR";

  // Cadastro do cliente + tipo de serviço (para os placeholders).
  const { data: caso } = await sb
    .from("system_cases")
    .select("client_id, case_type, service_type_id")
    .eq("id", termo.case_id)
    .single();
  const { data: cliente } = await sb
    .from("system_clients")
    .select("full_name, cpf_cnpj")
    .eq("id", caso?.client_id ?? "")
    .maybeSingle();
  let tipoServico: string | null = caso?.case_type ?? null;
  if (caso?.service_type_id) {
    const { data: st } = await sb
      .from("system_service_types")
      .select("name")
      .eq("id", caso.service_type_id)
      .maybeSingle();
    if (st?.name) tipoServico = st.name;
  }

  const templateId = await resolveTermoTemplateId(tipo);
  const values = buildTermoValues(
    termo,
    { full_name: cliente?.full_name ?? null, cpf_cnpj: cliente?.cpf_cnpj ?? null },
    tipoServico,
    {
      remanescenteAnteriorCentavos: input.remanescenteAnteriorCentavos,
      saldoAtualCentavos: input.saldoAtualCentavos,
      percentualAbatimento: input.percentualAbatimento,
      saldoOriginarioCentavos: input.saldoOriginarioCentavos,
      saldoEpocaAbatimentoCentavos: input.saldoEpocaAbatimentoCentavos,
    },
  );

  // Motor de docs: copia o modelo, substitui placeholders, torna link-editável,
  // grava em system_case_documents e devolve o editUrl. Falha externa → 424.
  const { doc, editUrl } = await generateCaseDocumentFromTemplate({
    caseId: termo.case_id,
    templateId,
    title: `Termo de Acerto ${tipo} — v${termo.version}`,
    values,
    docKind: "TERMO_ACERTO",
    triggeredBy: input.triggeredBy ?? undefined,
  });

  // Grava o link do doc editável no snapshot RASCUNHO (drive_url).
  const editable = doc.google_doc_id ? docUrl(doc.google_doc_id) : editUrl;
  const { data: updated, error: upErr } = await sb
    .from("system_termo_snapshots")
    .update({ drive_url: editable })
    .eq("id", termo.id)
    .eq("status", "RASCUNHO")
    .select()
    .single();
  if (upErr || !updated) {
    throw new TermoServiceError(upErr?.message ?? "Falha ao gravar link do documento no termo", 500);
  }

  return { termo: updated, docId: doc.id, editUrl: editable };
}
