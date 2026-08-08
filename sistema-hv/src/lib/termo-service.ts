// Server-only — Termo de Acerto: calculadora (PRD §9.2, em CENTAVOS/inteiros)
// + snapshots imutáveis (S17a) + conferência segregada/aprovação híbrida/PDF (S17b).

import { createHash } from "node:crypto";

import {
  ensureCaseFolder,
  generateCaseDocumentFromTemplate,
  softDeleteCaseDocument,
} from "./case-documents-service";
import { syncClientToContaAzul } from "./contaazul/service";
import {
  criarBaixa,
  criarContaAReceber,
  listContasFinanceiras,
  type CAContaReceberParcela,
  type CAMetodoPagamento,
} from "./contaazul/client";
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

// Exclui um termo em RASCUNHO: apaga o snapshot + o documento gerado (Google Doc/
// PDF) no Drive, de forma sincronizada com Documentos. Só RASCUNHO (aprovado é
// imutável). O documento é removido com cascadeTermo:false para não recursar.
export async function deleteTermoRascunho(termoId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const termo = await getTermo(termoId);
  if (termo.status !== "RASCUNHO") {
    throw new TermoServiceError(
      "Só é possível excluir termos em rascunho. Termos aprovados são imutáveis.",
      409,
    );
  }

  // Documento gerado do termo (doc_kind='TERMO_ACERTO') do caso → apaga do Drive.
  const { data: doc } = await sb
    .from("system_case_documents")
    .select("id")
    .eq("case_id", termo.case_id)
    .eq("doc_kind", "TERMO_ACERTO")
    .is("deleted_at", null)
    .maybeSingle();
  if (doc?.id) {
    await softDeleteCaseDocument(doc.id, `termo.delete:${termoId}`, { cascadeTermo: false });
  }

  // Remove o snapshot RASCUNHO.
  const { error } = await sb
    .from("system_termo_snapshots")
    .delete()
    .eq("id", termoId)
    .eq("status", "RASCUNHO");
  if (error) throw new TermoServiceError(error.message, 500);

  await sb.from("system_audit_log").insert({
    organization_id: termo.organization_id,
    action: "termo.delete_rascunho",
    entity_type: "termo",
    entity_id: termoId,
    diff: { case_id: termo.case_id, doc_id: doc?.id ?? null },
    actor_id: triggeredBy ?? null,
  });

  return { ok: true as const, id: termoId, docDeleted: !!doc?.id };
}

/**
 * Exclusão administrativa de termo em QUALQUER status (inclusive aprovado/aceito).
 * Remove parcelas vinculadas, documento do Drive e o snapshot. Registra audit log.
 * Só deve ser chamada por usuários com role admin.
 */
export async function deleteTermoAdmin(termoId: string, triggeredBy: string) {
  const sb = getSupabaseAdmin();
  const termo = await getTermo(termoId);

  // Remove documento do Drive (soft delete).
  const { data: doc } = await sb
    .from("system_case_documents")
    .select("id")
    .eq("case_id", termo.case_id)
    .eq("doc_kind", "TERMO_ACERTO")
    .is("deleted_at", null)
    .maybeSingle();
  if (doc?.id) {
    await softDeleteCaseDocument(doc.id, `termo.admin_delete:${termoId}`, {
      cascadeTermo: false,
    });
  }

  // Remove parcelas vinculadas ao termo.
  const { data: parcelasRemovidas } = await sb
    .from("system_parcelas")
    .delete()
    .eq("termo_id", termoId)
    .select("id");

  // Remove o snapshot (qualquer status).
  const { error } = await sb.from("system_termo_snapshots").delete().eq("id", termoId);
  if (error) throw new TermoServiceError(error.message, 500);

  await sb.from("system_audit_log").insert({
    organization_id: termo.organization_id,
    action: "termo.admin_delete",
    entity_type: "termo",
    entity_id: termoId,
    diff: {
      case_id: termo.case_id,
      status: termo.status,
      doc_id: doc?.id ?? null,
      parcelas_removidas: parcelasRemovidas?.length ?? 0,
    },
    actor_id: triggeredBy,
  });

  return {
    ok: true as const,
    id: termoId,
    docDeleted: !!doc?.id,
    parcelasRemovidas: parcelasRemovidas?.length ?? 0,
  };
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

  // ── Sync automático: cria cliente + cobrança no Conta Azul (best-effort) ──
  try {
    // Busca client_id e case_code do caso
    const { data: caso } = await sb
      .from("system_cases")
      .select("client_id, case_code")
      .eq("id", termo.case_id)
      .single();

    if (caso?.client_id) {
      // 1) Sincroniza a pessoa (cliente) no Conta Azul
      const { contaAzulCustomerId } = await syncClientToContaAzul(caso.client_id);

      // 2) Busca conta financeira (Receba Fácil / Conta PJ)
      const contas = await listContasFinanceiras().catch(() => ({
        itens: [] as { id: string }[],
        itens_totais: 0,
      }));
      const contaFinanceiraId = contas.itens?.[0]?.id ?? null;

      if (contaFinanceiraId) {
        // 3) Monta parcelas para o Conta Azul
        const descricaoBase = `Honorários advocatícios — ${caso.case_code}`;
        const parcelasPayload: CAContaReceberParcela[] = rows.map((r, i) => ({
          descricao: rows.length > 1 ? `${descricaoBase} (${i + 1}/${rows.length})` : descricaoBase,
          data_vencimento: r.vencimento,
          nota: caso.case_code,
          conta_financeira: contaFinanceiraId,
          detalhe_valor: { valor_bruto: r.valor_centavos / 100 },
        }));

        const valorTotalReais = rows.reduce((s, r) => s + r.valor_centavos, 0) / 100;

        // 4) Cria a conta a receber no Conta Azul
        await criarContaAReceber({
          data_competencia: rows[0].vencimento,
          valor: valorTotalReais,
          observacao: descricaoBase,
          descricao: descricaoBase,
          contato: contaAzulCustomerId,
          conta_financeira: contaFinanceiraId,
          condicao_pagamento: { parcelas: parcelasPayload },
        });

        // 5) Marca as parcelas locais como provider "conta_azul" para o cron de sync
        await sb.from("system_parcelas").update({ provider: "conta_azul" }).eq("termo_id", termoId);

        console.log(
          `contaazul: cobrança criada automaticamente para caso ${caso.case_code} (${rows.length} parcelas)`,
        );
      } else {
        console.warn(
          "contaazul: conta financeira não encontrada — cobrança não criada automaticamente",
        );
      }
    }
  } catch (err) {
    // Best-effort: não impede a aceitação do termo se o Conta Azul falhar
    console.error(
      "contaazul: falha ao sincronizar automaticamente na aceitação do termo:",
      err instanceof Error ? err.message : err,
    );
  }

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

// M6 (2026-08-07) — grava o nº da fatura do Conta Azul da parcela (identificação
// MANUAL, texto livre; não fala com a API do CA). Vazio/whitespace → NULL (limpa).
// O trigger system_fn_audit já registra o UPDATE. Independe do provider.
export async function setParcelaContaAzulFatura(parcelaId: string, faturaNumero: string | null) {
  const sb = getSupabaseAdmin();
  const value = faturaNumero && faturaNumero.trim() ? faturaNumero.trim() : null;
  const { data, error } = await sb
    .from("system_parcelas")
    .update({ contaazul_fatura_numero: value })
    .eq("id", parcelaId)
    .select("id")
    .single();
  if (error || !data) {
    throw new TermoServiceError(error?.message ?? "Parcela não encontrada", 404);
  }
  return { ok: true as const, id: parcelaId, contaazul_fatura_numero: value };
}

// (item 5, 2026-07-10) — exclui UMA parcela (soft-delete; some da lista/relatório).
// Quando a cobrança existir no Conta Azul (provider='conta_azul' + provider_ext_id),
// o cancelamento espelhado no CA entra junto com o build de cobrança (#1).
export async function deleteParcela(parcelaId: string) {
  const sb = getSupabaseAdmin();
  const { data: p } = await sb
    .from("system_parcelas")
    .select("id, case_id, organization_id, numero")
    .eq("id", parcelaId)
    .maybeSingle();
  if (!p) throw new TermoServiceError("Parcela não encontrada", 404);
  // system_parcelas NÃO tem deleted_at → DELETE real (some da lista/relatório).
  const { error } = await sb.from("system_parcelas").delete().eq("id", parcelaId);
  if (error) throw new TermoServiceError(error.message, 500);
  await sb.from("system_audit_log").insert({
    organization_id: p.organization_id,
    action: "parcela.delete",
    entity_type: "parcela",
    entity_id: parcelaId,
    diff: { numero: p.numero, case_id: p.case_id },
  });
  return { ok: true as const, id: parcelaId };
}

// (item 5) — exclui TODAS as parcelas do caso (DELETE real; sem deleted_at).
export async function deleteAllParcelasDoCaso(caseId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_parcelas")
    .delete()
    .eq("case_id", caseId)
    .select("id");
  if (error) throw new TermoServiceError(error.message, 500);
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "parcela.delete_all",
    entity_type: "case",
    entity_id: caseId,
    diff: { count: data?.length ?? 0 },
  });
  return { ok: true as const, count: data?.length ?? 0 };
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

  // Conta Azul (2026-07-20) — reflete a baixa MANUAL no Conta Azul quando a parcela
  // tem cobrança lá (provider='conta_azul' + id da parcela CA já reconciliado). Assim
  // o CA não diverge do sistema. BEST-EFFORT: se o CA falhar (ou a parcela ainda não
  // foi reconciliada), a baixa LOCAL permanece — só loga o erro.
  const prov = data as { provider?: string | null; provider_ext_id?: string | null };
  if (prov.provider === "conta_azul" && prov.provider_ext_id) {
    try {
      const contas = await listContasFinanceiras().catch(() => ({ itens: [] as { id: string }[] }));
      const contaFinanceiraId = contas.itens?.[0]?.id ?? null;
      if (contaFinanceiraId) {
        await criarBaixa(prov.provider_ext_id, {
          data_pagamento: (input.dataPagamento ?? new Date().toISOString()).slice(0, 10),
          composicao_valor: { valor_bruto: input.valorPagoCentavos / 100 },
          conta_financeira: contaFinanceiraId,
          metodo_pagamento: toCAMetodoPagamento(input.metodoPagamento),
          observacao: "Baixa registrada pelo Sistema HV",
        });
      }
    } catch (err) {
      console.error(
        "darBaixaParcela: parcela baixada localmente, mas falhou refletir no Conta Azul:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return data;
}

// Mapeia o método (texto livre da baixa manual) para o enum de método do Conta
// Azul. Sem correspondência clara → OUTRO; vazio → undefined (CA usa o default).
function toCAMetodoPagamento(free: string | null | undefined): CAMetodoPagamento | undefined {
  if (!free) return undefined;
  const s = free.toLowerCase();
  if (s.includes("pix")) return "CARTEIRA_DIGITAL";
  if (s.includes("boleto")) return "BOLETO_BANCARIO";
  if (s.includes("transf") || s.includes("ted") || s.includes("doc"))
    return "TRANSFERENCIA_BANCARIA";
  if (s.includes("dinheiro") || s.includes("espécie") || s.includes("especie")) return "DINHEIRO";
  if (s.includes("débito") || s.includes("debito")) return "CARTAO_DEBITO";
  if (
    s.includes("crédito") ||
    s.includes("credito") ||
    s.includes("cartão") ||
    s.includes("cartao")
  )
    return "CARTAO_CREDITO";
  if (s.includes("cheque")) return "CHEQUE";
  return "OUTRO";
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
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const _DEZ = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const _CEM = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
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
  if (milhoes > 0) parts.push(`${_ate999(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  if (milhares > 0) parts.push(`${milhares === 1 ? "mil" : `${_ate999(milhares)} mil`}`);
  if (resto > 0) parts.push(_ate999(resto));
  return (
    parts
      .join(", ")
      .replace(/,([^,]*)$/, " e$1")
      .trim() || "zero"
  );
}

// Reais por extenso (arredonda centavos ao real). Ex.: 150000 → "mil e quinhentos reais".
export function reaisPorExtenso(centavos: number): string {
  const reais = Math.round((centavos ?? 0) / 100);
  return `${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`;
}

// ITEM 5b (2026-07-07) — os MODELOS de termo já trazem "R$ " ANTES de cada
// placeholder monetário (ex.: "R$ <valor_abatimento>"). Se o valor também vier
// com "R$ ", o doc sai com "R$ R$ 2.000,00" (duplicado). Por isso os campos
// monetários usam `numDoc` (só o número, ex.: "2.000,00"); o template fornece o
// "R$ ". Os placeholders NÃO-monetários (_extenso, percentual_*, qtd_parcelas,
// taxa_juros, percentual_financiado, data_*) não levam "R$ " nem por numDoc.
function numDoc(c: number | null | undefined) {
  // Formato BR com separador de milhar, SEM "R$ " (ex.: 513.297,38).
  return ((c ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Mantido para o PDF-resumo (gerarPdfTermo), que NÃO usa template com "R$ ".
function brlDoc(c: number | null | undefined) {
  return "R$ " + numDoc(c);
}

// Reparcela um total (centavos) em parcelas de `valorParcela`, aplicando a MESMA
// regra de calcularTermo (floor das cheias; resto vira última parcela; resto
// abaixo de `restoMinimo` incorpora à última). Usado só para o parcelamento
// EXIBIDO no documento COMPLEMENTAR (sobre honorarios_total = abatimento +
// remanescente). NÃO altera calcularTermo nem o snapshot. Retorna qtd TOTAL de
// parcelas (cheias + a irregular), o valor da cheia e o valor da última.
function reparcelar(
  totalCentavos: number,
  valorParcela: number,
  restoMinimo: number,
): { qtd: number; valorParcela: number; valorUltima: number } {
  const total = Math.max(0, totalCentavos);
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
  } else if (resto < restoMinimo) {
    ultima = valorParcela + resto; // incorpora à última
  } else {
    qtd += 1;
    ultima = resto;
  }
  return { qtd, valorParcela, valorUltima: ultima };
}

// Convenção de nome do modelo por tipo_termo. O modelo Google Doc deve ter, no
// NOME, "TERMO ACERTO PARCIAL" ou "TERMO ACERTO COMPLEMENTAR" (case-insensitive,
// acentos/hífen ignorados). Ajustar aqui se o owner mudar a convenção.
function templateNameMatches(name: string, tipo: "PARCIAL" | "COMPLEMENTAR"): boolean {
  const norm = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
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
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
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
  taxaJuros?: string | null; // FIES — texto livre (ex.: "0,28")
  percentualFinanciado?: string | null; // FIES — texto livre (ex.: "100,00")
};

// Data no formato dd/mm/aaaa (ex.: 07/07/2026). Usada na data de assinatura.
function dataDDMMAAAA(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

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

  // ── Parcelamento EXIBIDO no documento ────────────────────────────────────
  // PARCIAL: usa os valores do snapshot (calcularTermo já parcelou sobre o
  //   valor_total do abatimento — que é o total devido nesse tipo).
  // COMPLEMENTAR: o total efetivamente devido no DOCUMENTO é
  //   honorariosTotalCentavos (= abatimento novo + remanescente anterior), NÃO
  //   o valor_total do snapshot. Reparcela sobre esse total aplicando a MESMA
  //   regra do calcularTermo (floor das cheias; resto vira última; resto abaixo
  //   do mínimo incorpora à última) — sem tocar em calcularTermo nem no snapshot
  //   (que continua guardando o parcelamento do abatimento novo p/ as cobranças).
  const parcelamentoDoc = isComplementar
    ? reparcelar(
        honorariosTotalCentavos,
        termo.valor_parcela_centavos,
        TERMO_DEFAULTS.resto_minimo_centavos,
      )
    : {
        qtd: termo.qtd_parcelas ?? 0,
        valorParcela: termo.valor_parcela_centavos,
        valorUltima: termo.valor_ultima_parcela_centavos,
      };

  // ── Derivados (calculados a partir do snapshot quando os extras não vierem) ──
  // Base da conta do abatimento: saldo à época = saldo antes − parcelas pagas
  // (referência histórica sobre a qual o percentual do abatimento é medido).
  const saldoEpocaCalcCentavos = termo.saldo_antes_centavos - termo.parcelas_pagas_centavos;
  // saldo à época: override do extra tem prioridade; senão calcula.
  const saldoEpocaValue =
    extras.saldoEpocaAbatimentoCentavos != null
      ? numDoc(extras.saldoEpocaAbatimentoCentavos)
      : numDoc(saldoEpocaCalcCentavos);
  // saldo atual (PARCIAL) = saldo depois; override do extra tem prioridade.
  const saldoAtualValue =
    extras.saldoAtualCentavos != null
      ? numDoc(extras.saldoAtualCentavos)
      : numDoc(termo.saldo_depois_centavos);
  // percentual do abatimento = efetivo / saldo à época × 100 (ex.: "31.82%").
  // Denominador ≤ 0 → sem base p/ o cálculo → cai no override (ou vazio).
  const percentualAbatimentoValue =
    extras.percentualAbatimento != null
      ? `${extras.percentualAbatimento}%`
      : saldoEpocaCalcCentavos > 0
        ? `${((termo.valor_efetivo_centavos / saldoEpocaCalcCentavos) * 100).toFixed(2)}%`
        : "";
  // saldo devedor originário = referência histórica; sem fonte no cálculo cai no
  // saldo antes (override do extra tem prioridade).
  const saldoOriginarioValue =
    extras.saldoOriginarioCentavos != null
      ? numDoc(extras.saldoOriginarioCentavos)
      : numDoc(termo.saldo_antes_centavos);

  const values: Record<string, string> = {
    // ── Comuns aos 2 modelos ──────────────────────────────────────────────
    nome_cliente: cliente.full_name ?? "",
    cpf_cliente: cliente.cpf_cnpj ?? "",
    tipo_servico: tipoServico ?? "",
    // Monetários → só o número (o template já tem "R$ " antes). ITEM 5b.
    saldo_antes: numDoc(termo.saldo_antes_centavos),
    saldo_depois: numDoc(termo.saldo_depois_centavos),
    parcelas_pagas: numDoc(termo.parcelas_pagas_centavos),
    valor_abatimento: numDoc(termo.valor_efetivo_centavos),
    percentual_honorarios: `${termo.percentual_honorarios}%`,
    honorarios_total: numDoc(honorariosTotalCentavos),
    honorarios_total_extenso: reaisPorExtenso(honorariosTotalCentavos),
    // O modelo diz "<qtd_parcelas> parcelas de <valor_parcela> além de 1 parcela
    // de <valor_ultima_parcela>": o N é a contagem das parcelas CHEIAS (a última
    // irregular é a "1 parcela" à parte). Exibe qtd − 1; o snapshot mantém o total
    // real para a geração das cobranças. Em COMPLEMENTAR o parcelamento exibido é
    // reparcelado sobre honorariosTotalCentavos (vide parcelamentoDoc acima).
    qtd_parcelas: String(Math.max(0, (parcelamentoDoc.qtd ?? 0) - 1)),
    valor_parcela: numDoc(parcelamentoDoc.valorParcela),
    valor_ultima_parcela: numDoc(parcelamentoDoc.valorUltima),
    desconto_avista: `${termo.desconto_avista_pct}%`,
    valor_avista: numDoc(termo.valor_avista_centavos),
    valor_avista_extenso: reaisPorExtenso(termo.valor_avista_centavos),
    data_extenso: dataPorExtenso(),

    // ── Só PARCIAL ────────────────────────────────────────────────────────
    // saldo_atual = saldo depois; percentual_abatimento = efetivo/época×100.
    // Ambos calculados do snapshot; override do extra (input da tela) tem prioridade.
    saldo_atual: saldoAtualValue,
    percentual_abatimento: percentualAbatimentoValue,
    valor_ultima_parcela_extenso: reaisPorExtenso(parcelamentoDoc.valorUltima),

    // ── FIES (prints do portal viraram texto editável nos modelos) ──────────
    // taxa_juros / percentual_financiado vêm dos inputs da tela elaborar (texto
    // livre). Se vazios, saem "" (nunca o <placeholder> literal). A taxa ganha
    // "%" quando o usuário não digitar (ex.: "0,28" → "0,28%").
    taxa_juros: extras.taxaJuros
      ? extras.taxaJuros.includes("%")
        ? extras.taxaJuros
        : `${extras.taxaJuros}%`
      : "",
    percentual_financiado: extras.percentualFinanciado ?? "",
    // Data de assinatura: SEMPRE a data atual da geração (dd/mm/aaaa).
    data_assinatura_fies: dataDDMMAAAA(),

    // ── Só COMPLEMENTAR ───────────────────────────────────────────────────
    // honorarios_abatimento = só o abatimento novo (valor_total do cálculo).
    honorarios_abatimento: numDoc(termo.valor_total_centavos),
    // remanescente_anterior = valor digitado (0 fora do COMPLEMENTAR → vazio).
    remanescente_anterior: isComplementar ? numDoc(remanescenteCentavos) : "",
    // saldo_originario / saldo_epoca_abatimento: calculados do snapshot; override
    // do extra tem prioridade (saldo_originario cai em saldo antes se não vier).
    saldo_originario: saldoOriginarioValue,
    saldo_epoca_abatimento: saldoEpocaValue,
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
  taxaJuros?: string;
  percentualFinanciado?: string;
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
      taxaJuros: input.taxaJuros,
      percentualFinanciado: input.percentualFinanciado,
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
    throw new TermoServiceError(
      upErr?.message ?? "Falha ao gravar link do documento no termo",
      500,
    );
  }

  return { termo: updated, docId: doc.id, editUrl: editable };
}
