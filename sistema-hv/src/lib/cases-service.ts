// Server-only — CRUD de casos + timeline + audit.
// NUNCA importe no browser.

import { instanciarChecklist } from "./checklist-service";
import {
  buildAutoFillFromClient,
  buildAutoFillValues,
  resolveAutoValue,
  type TemplateField,
} from "./cases/document-autofill";
import { type MacroFin, type MacroOp } from "./cases/constants";
import { createFolder, DriveError } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";
import type { Database } from "./supabase/types";
import type { CaseCreateOutput, CaseUpdateOutput } from "./validators/case";

type CaseUpdateRow = Database["public"]["Tables"]["system_cases"]["Update"];

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class CaseServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CaseServiceError";
  }
}

// ----------------------------------------------------------------------------
// case_code generator: {TIPO}-{YEAR}-{NNNN}
// ----------------------------------------------------------------------------
async function nextCaseCode(caseType: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("nextval_seq_system_case_code");
  if (error) {
    const fallback = Date.now().toString().slice(-5);
    return `${caseType.split("_")[0]}-${new Date().getFullYear()}-${fallback}`;
  }
  const n = typeof data === "number" ? data : Number(data ?? 0);
  const year = new Date().getFullYear();
  const tipoShort = caseType.split("_")[0];
  return `${tipoShort}-${year}-${String(n).padStart(4, "0")}`;
}

// ----------------------------------------------------------------------------
// CREATE
// ----------------------------------------------------------------------------
export async function createCase(
  input: CaseCreateOutput,
  triggeredBy?: string,
  opts?: { skipProcuracaoPrep?: boolean },
) {
  const sb = getSupabaseAdmin();

  // Validar cliente existe e está ativo (já busca drive_folder_id para criar subpasta)
  const { data: client, error: clientErr } = await sb
    .from("system_clients")
    .select("id, drive_folder_id")
    .eq("id", input.client_id)
    .is("deleted_at", null)
    .single();
  if (clientErr || !client) {
    throw new CaseServiceError("Cliente não encontrado ou desativado", 404);
  }

  const code = await nextCaseCode(input.case_type);

  // Busca a primeira etapa operacional do service_type para não usar slug hardcoded
  let defaultOpStatus: string = input.macrostatus_op ?? "ONBOARDING";
  if (!input.macrostatus_op) {
    const { data: stType } = await sb
      .from("system_service_types")
      .select("id")
      .eq("slug", input.case_type)
      .is("deleted_at", null)
      .single();
    if (stType) {
      const { data: firstOpStage } = await sb
        .from("system_pipeline_stages")
        .select("slug")
        .eq("service_type_id", stType.id)
        .eq("kind", "op")
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .limit(1)
        .single();
      if (firstOpStage) {
        defaultOpStatus = firstOpStage.slug;
      }
    }
  }

  // S1-02: DESACOPLAR criação de caso do envio de procuração. Criar o caso NÃO
  // seta mais `aguardando_assinatura_at` — o caso nasce lifecycle='LEAD' (default
  // da coluna, S1-01) e a flag comercial só é setada no ATO explícito de enviar a
  // procuração ao ZapSign (sendCaseDocumentToZapsign, quando doc_kind='procuracao').
  // `comercial` continua governando apenas se preparamos o DOC de procuração
  // (placeholder/geração), não a flag de "aguardando assinatura".
  const comercial = input.comercial === true;

  // S5-02: caso comercial entra na pipeline de leads na 1ª etapa comercial
  // (ordem 0) do seu tipo. Dual-write via macrostatus_comercial (a projeção
  // system_fn_sync_stage_ids preenche stage_comercial_id). Best-effort: se o tipo
  // não tiver esteira comercial semeada, o caso nasce sem etapa comercial.
  let defaultComercialStatus: string | null = null;
  if (comercial) {
    const { data: stTypeCom } = await sb
      .from("system_service_types")
      .select("id")
      .eq("slug", input.case_type)
      .is("deleted_at", null)
      .single();
    if (stTypeCom) {
      const { data: firstComStage } = await sb
        .from("system_pipeline_stages")
        .select("slug")
        .eq("service_type_id", stTypeCom.id)
        .eq("kind", "comercial")
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .limit(1)
        .single();
      if (firstComStage) defaultComercialStatus = firstComStage.slug;
    }
  }

  const { data: created, error } = await sb
    .from("system_cases")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      client_id: input.client_id,
      case_code: code,
      case_type: input.case_type,
      macrostatus_op: defaultOpStatus,
      macrostatus_fin: input.macrostatus_fin ?? "NAO_APLICAVEL",
      macrostatus_comercial: defaultComercialStatus,
      proximo_passo: input.proximo_passo ?? null,
      responsavel: input.responsavel ?? null,
      municipio: input.municipio ?? null,
      valor_centavos: input.valor_centavos ?? null,
      // S1-02: a flag comercial passa a ser setada no envio da procuração, não aqui.
      aguardando_assinatura_at: null,
    })
    .select()
    .single();

  if (error || !created) {
    throw new CaseServiceError(error?.message ?? "Falha ao criar caso", 500);
  }

  await sb.from("system_case_events").insert({
    case_id: created.id,
    organization_id: DEFAULT_ORG_ID,
    action: comercial ? "created_comercial" : "created",
    to_macrostatus_op: created.macrostatus_op,
    diff: { case_type: created.case_type, client_id: created.client_id, comercial },
    triggered_by: triggeredBy ?? null,
  });

  // Best-effort: criar subpasta do caso no Drive (dentro da pasta do cliente)
  let result = created;
  if (client.drive_folder_id) {
    try {
      const folder = await createFolder(`Caso-${created.case_code}`, client.drive_folder_id);
      await sb
        .from("system_cases")
        .update({
          drive_folder_id: folder.id,
          drive_folder_url: folder.url,
          drive_sync_failed: false,
          drive_sync_error: null,
        })
        .eq("id", created.id);
      result = { ...created, drive_folder_id: folder.id, drive_folder_url: folder.url };
    } catch (err) {
      const msg =
        err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
      await sb
        .from("system_cases")
        .update({ drive_sync_failed: true, drive_sync_error: msg.slice(0, 2000) })
        .eq("id", created.id);
      console.error("cases-service: falha ao criar pasta do caso no Drive:", msg);
    }
  }

  // Fase comercial: prepara o documento de procuração (best-effort).
  // Se o usuário escolheu um modelo no ato, gera a procuração já preenchida com
  // os dados do cliente; senão cai no placeholder (modelo definido depois).
  // skipProcuracaoPrep: o fluxo de revisão (createComercialCaseAndGenerate
  // Procuracao) cuida da geração com os valores revisados — não duplicar aqui.
  if (comercial && !opts?.skipProcuracaoPrep) {
    try {
      if (input.procuracao_template_id) {
        await generateProcuracaoFromTemplate(
          created.id,
          input.procuracao_template_id,
          input.client_id,
          triggeredBy,
        );
      } else {
        await ensureProcuracaoDocument(created.id, triggeredBy);
      }
    } catch (err) {
      console.error("cases-service: falha ao preparar procuração:", err);
    }
  }

  return result;
}

// ----------------------------------------------------------------------------
// PROCURAÇÃO — garante um documento de procuração para o caso comercial.
// Se houver um modelo (template) de procuração para o tipo, gera por ele; senão
// cria um registro placeholder (doc_kind='procuracao') que fica na ficha do caso
// com os botões de enviar ao ZapSign / baixar — pronto pra ativar quando o
// modelo for anexado pelo escritório. (Decisão 2026-06-22.)
// ----------------------------------------------------------------------------
export async function ensureProcuracaoDocument(caseId: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();

  // Já existe procuração para este caso? (idempotente)
  const { data: existing } = await sb
    .from("system_case_documents")
    .select("id")
    .eq("case_id", caseId)
    .eq("doc_kind", "procuracao")
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return existing;

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id, case_type")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  // Procura um modelo de procuração para o tipo de serviço.
  const { data: tpl } = await sb
    .from("system_document_templates")
    .select("id")
    .eq("case_type", caso.case_type)
    .is("deleted_at", null)
    .ilike("name", "%procura%")
    .limit(1)
    .maybeSingle();

  // Cria o registro do documento (placeholder enquanto não há modelo configurado).
  const { data: doc, error } = await sb
    .from("system_case_documents")
    .insert({
      case_id: caso.id,
      organization_id: caso.organization_id,
      title: "Procuração",
      status: "RASCUNHO",
      source: "GERADO",
      doc_kind: "procuracao",
      goes_to_zapsign: true,
      template_id: tpl?.id ?? null,
    })
    .select()
    .single();
  if (error || !doc) throw new CaseServiceError(error?.message ?? "Falha ao criar procuração", 500);

  await sb.from("system_case_events").insert({
    case_id: caso.id,
    organization_id: caso.organization_id,
    action: "procuracao_preparada",
    diff: { doc_id: doc.id, template_id: tpl?.id ?? null },
    triggered_by: triggeredBy ?? null,
  });

  return doc;
}

// ----------------------------------------------------------------------------
// PROCURAÇÃO (com modelo) — gera a procuração já preenchida com os dados do
// cliente, a partir de um modelo escolhido no ato da criação do caso comercial.
// NÃO envia ao ZapSign: o documento nasce em edição, para revisão antes do
// disparo. (Decisão 2026-06-22: gerar e revisar antes.)
// ----------------------------------------------------------------------------
export async function generateProcuracaoFromTemplate(
  caseId: string,
  templateId: string,
  clientId: string,
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();

  // Idempotente: se já existe procuração no caso, não duplica.
  const { data: existing } = await sb
    .from("system_case_documents")
    .select("id")
    .eq("case_id", caseId)
    .eq("doc_kind", "procuracao")
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return existing;

  // Dados do caso (para município / código / responsável) e do cliente completo.
  const { data: caso } = await sb
    .from("system_cases")
    .select("id, case_code, municipio, responsavel")
    .eq("id", caseId)
    .single();

  const { data: client } = await sb
    .from("system_clients")
    .select("full_name, cpf_cnpj, email, phone, address, professional_data")
    .eq("id", clientId)
    .single();

  const { data: tpl } = await sb
    .from("system_document_templates")
    .select("fields")
    .eq("id", templateId)
    .is("deleted_at", null)
    .single();

  const fields = ((tpl?.fields ?? []) as TemplateField[]) ?? [];
  const data = buildAutoFillFromClient(client ?? {}, caso ?? {});
  const values = buildAutoFillValues(fields, data);

  // Import dinâmico evita ciclo entre cases-service e case-documents-service.
  const { generateCaseDocumentFromTemplate } = await import("./case-documents-service");
  return generateCaseDocumentFromTemplate({
    caseId,
    templateId,
    values,
    docKind: "procuracao",
    triggeredBy,
  });
}

// ----------------------------------------------------------------------------
// PROCURAÇÃO — PREVIEW (revisão antes de criar o caso). Lê os campos <...> do
// modelo (ao vivo do Google Doc) e resolve os valores a partir do cadastro do
// cliente. NÃO grava nada — é só para o usuário revisar/editar antes de enviar.
// ----------------------------------------------------------------------------
export async function previewProcuracao(input: {
  clientId: string;
  templateId: string;
  municipio?: string | null;
  responsavel?: string | null;
}): Promise<{
  fields: TemplateField[];
  values: Record<string, string>;
  signer: { name: string; email: string | null };
}> {
  const sb = getSupabaseAdmin();

  const { data: tpl } = await sb
    .from("system_document_templates")
    .select("google_doc_id, fields")
    .eq("id", input.templateId)
    .is("deleted_at", null)
    .single();
  if (!tpl) throw new CaseServiceError("Modelo de procuração não encontrado", 404);

  const { data: client } = await sb
    .from("system_clients")
    .select("full_name, cpf_cnpj, email, phone, address, professional_data")
    .eq("id", input.clientId)
    .is("deleted_at", null)
    .single();
  if (!client) throw new CaseServiceError("Cliente não encontrado", 404);

  // Campos ao vivo do Google Doc (autoritativo); fallback nos campos salvos.
  let fields: TemplateField[] = ((tpl.fields ?? []) as TemplateField[]) ?? [];
  if (tpl.google_doc_id) {
    try {
      const { getTemplatePlaceholders } = await import("./template-sync-service");
      const live = await getTemplatePlaceholders(tpl.google_doc_id);
      if (live.length) fields = live as TemplateField[];
    } catch (err) {
      // Sem acesso ao Doc agora? Cai nos campos salvos no banco.
      console.error("previewProcuracao: falha ao ler placeholders ao vivo:", err);
    }
  }
  // Não exibe campos "em branco" (preenchidos depois, na edição).
  fields = fields.filter((f) => f.source !== "blank");

  const data = buildAutoFillFromClient(client, {
    municipio: input.municipio ?? undefined,
    responsavel: input.responsavel ?? undefined,
    // case_code ainda não existe (caso não criado) — resolvido no envio real.
  });

  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = resolveAutoValue(f, data);
    if (v) values[f.key] = v;
  }

  return {
    fields,
    values,
    signer: { name: client.full_name ?? "", email: client.email ?? null },
  };
}

// ----------------------------------------------------------------------------
// S7-01 — Honorários da procuração (valores estruturados p/ persistência).
// A origem preferida (opção A da story) é o payload estruturado vindo da revisão
// (ProcuracaoReviewStep). Quando não vier, fazemos um fallback best-effort
// parseando os placeholders conhecidos do finalValues (BRL→centavos, "15%"→15).
// ----------------------------------------------------------------------------
export type CaseHonorariosInput = {
  percentualHonorarios?: number | null;
  valorParcelaCentavos?: number | null;
  descontoAvistaPct?: number | null;
  formaPagamento?: string | null;
  honorariosTotalCentavos?: number | null;
};

// "R$ 1.234,56" / "1234,56" / "1.234" → centavos (int). null se não parseável.
function brlToCentavos(v: string | undefined | null): number | null {
  if (v == null) return null;
  const cleaned = String(v).replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// "15%" / "15" / "15,5" → número. null se não parseável.
function pctToNumber(v: string | undefined | null): number | null {
  if (v == null) return null;
  const cleaned = String(v).replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Extrai honorários estruturados do map de placeholders (fallback da opção A).
function honorariosFromValues(values: Record<string, string>): CaseHonorariosInput {
  return {
    percentualHonorarios: pctToNumber(values.percentual_honorarios),
    valorParcelaCentavos: brlToCentavos(values.valor_parcela),
    descontoAvistaPct: pctToNumber(values.desconto_avista),
    honorariosTotalCentavos:
      brlToCentavos(values.honorarios_total) ?? brlToCentavos(values.honorarios_abatimento),
    formaPagamento: null,
  };
}

// Best-effort: grava/atualiza os honorários do caso. NUNCA derruba a criação.
async function upsertCaseHonorarios(
  caseId: string,
  organizationId: string,
  honorarios: CaseHonorariosInput,
  createdBy?: string,
) {
  try {
    const sb = getSupabaseAdmin();
    // Só grava campos com valor (não sobrescreve com null o que já existir).
    const payload: Database["public"]["Tables"]["system_case_honorarios"]["Insert"] = {
      organization_id: organizationId,
      case_id: caseId,
      created_by: createdBy ?? null,
    };
    if (honorarios.percentualHonorarios != null)
      payload.percentual_honorarios = honorarios.percentualHonorarios;
    if (honorarios.valorParcelaCentavos != null)
      payload.valor_parcela_centavos = honorarios.valorParcelaCentavos;
    if (honorarios.descontoAvistaPct != null)
      payload.desconto_avista_pct = honorarios.descontoAvistaPct;
    if (honorarios.formaPagamento != null) payload.forma_pagamento = honorarios.formaPagamento;
    if (honorarios.honorariosTotalCentavos != null)
      payload.honorarios_total_centavos = honorarios.honorariosTotalCentavos;

    // O índice único é PARCIAL (WHERE deleted_at IS NULL), então o Postgres não o
    // aceita como árbitro de ON CONFLICT. Fazemos select-then-write manual pela
    // linha vigente do caso (1 vigente por caso).
    const { data: existing } = await sb
      .from("system_case_honorarios")
      .select("id")
      .eq("case_id", caseId)
      .is("deleted_at", null)
      .maybeSingle();
    const { error } = existing
      ? await sb.from("system_case_honorarios").update(payload).eq("id", existing.id)
      : await sb.from("system_case_honorarios").insert(payload);
    if (error) {
      console.error("upsertCaseHonorarios: falha ao gravar honorários do caso:", error.message);
    }
  } catch (err) {
    console.error("upsertCaseHonorarios: erro inesperado (ignorado):", err);
  }
}

// ----------------------------------------------------------------------------
// PROCURAÇÃO — CRIAR + GERAR (fluxo de revisão). Cria o caso comercial e gera a
// procuração com os valores REVISADOS pelo usuário, finalizando o PDF na pasta
// do caso. NÃO envia ao ZapSign — o documento fica na ficha do caso pronto para
// BAIXAR e para ENVIAR ao ZapSign quando o escritório quiser (botões na aba
// Documentos). O caso fica criado mesmo se um passo externo (Docs/Drive) falhar.
// ----------------------------------------------------------------------------
export async function createComercialCaseAndGenerateProcuracao(
  input: {
    case: CaseCreateOutput;
    templateId: string;
    values: Record<string, string>;
    // S7-01 (opção A): valores estruturados da revisão. Quando ausentes, cai no
    // fallback de parse dos placeholders (honorariosFromValues).
    honorarios?: CaseHonorariosInput;
  },
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();

  // 1) Cria o caso comercial SEM preparar a procuração (faremos abaixo com os
  //    valores revisados, evitando a geração automática duplicada).
  const created = await createCase(
    { ...input.case, comercial: true, procuracao_template_id: input.templateId },
    triggeredBy,
    { skipProcuracaoPrep: true },
  );

  // 2) Complementa os valores revisados com o autofill do caso já criado
  //    (ex.: código do caso, que só passa a existir agora). Os valores do
  //    usuário têm prioridade — só preenchemos o que ficou vazio.
  const { data: client } = await sb
    .from("system_clients")
    .select("full_name, cpf_cnpj, email, phone, address, professional_data")
    .eq("id", input.case.client_id)
    .single();
  const { data: tpl } = await sb
    .from("system_document_templates")
    .select("fields")
    .eq("id", input.templateId)
    .single();

  const serverData = buildAutoFillFromClient(client ?? {}, {
    municipio: created.municipio,
    case_code: created.case_code,
    responsavel: created.responsavel,
  });
  const serverAuto = buildAutoFillValues(
    ((tpl?.fields ?? []) as TemplateField[]) ?? [],
    serverData,
  );
  const finalValues: Record<string, string> = { ...serverAuto, ...input.values };

  // 2.1) S7-01 — persiste os honorários do caso (best-effort). Prioriza os
  //      valores ESTRUTURADOS vindos da revisão (opção A); senão, faz fallback
  //      parseando os placeholders do finalValues. Falha aqui NÃO derruba a
  //      criação do caso nem a geração da procuração.
  const structured = input.honorarios ?? {};
  const parsed = honorariosFromValues(finalValues);
  const honorarios: CaseHonorariosInput = {
    percentualHonorarios: structured.percentualHonorarios ?? parsed.percentualHonorarios,
    valorParcelaCentavos: structured.valorParcelaCentavos ?? parsed.valorParcelaCentavos,
    descontoAvistaPct: structured.descontoAvistaPct ?? parsed.descontoAvistaPct,
    formaPagamento: structured.formaPagamento ?? parsed.formaPagamento,
    honorariosTotalCentavos: structured.honorariosTotalCentavos ?? parsed.honorariosTotalCentavos,
  };
  await upsertCaseHonorarios(created.id, created.organization_id, honorarios, triggeredBy);

  // 3) Gera → finaliza (PDF na pasta do caso). Import dinâmico evita ciclo.
  //    O envio ao ZapSign é uma ação separada na ficha do caso.
  const { generateCaseDocumentFromTemplate, finalizeCaseDocument } =
    await import("./case-documents-service");

  const gen = await generateCaseDocumentFromTemplate({
    caseId: created.id,
    templateId: input.templateId,
    values: finalValues,
    docKind: "procuracao",
    triggeredBy,
  });

  const doc = await finalizeCaseDocument(gen.doc.id, triggeredBy);

  return { case: created, doc };
}

// ----------------------------------------------------------------------------
// COMERCIAL — lista de casos aguardando assinatura da procuração.
// ----------------------------------------------------------------------------
export async function listComercialCases() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases_active")
    .select("*")
    .not("aguardando_assinatura_at", "is", null)
    .order("aguardando_assinatura_at", { ascending: true });
  if (error) throw new CaseServiceError(error.message, 500);
  return data ?? [];
}

// ----------------------------------------------------------------------------
// LIBERAR — procuração assinada (webhook) ou confirmação manual. Limpa a flag
// comercial; o caso entra no funil operacional (já está na 1ª etapa).
// ----------------------------------------------------------------------------
export async function liberarCasoComercial(
  caseId: string,
  opts: { via: "webhook" | "manual"; userId?: string },
) {
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id, aguardando_assinatura_at")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  // Idempotente: se já não está aguardando, no-op.
  if (!caso.aguardando_assinatura_at) {
    return { ok: true as const, id: caseId, alreadyLiberado: true };
  }

  const { data, error } = await sb
    .from("system_cases")
    .update({
      aguardando_assinatura_at: null,
      assinatura_liberada_at: new Date().toISOString(),
      assinatura_liberada_by: opts.userId ?? null,
      // S1-01: procuração assinada ⇒ o caso vira CLIENTE (estado de 1ª classe).
      // Escrita de lifecycle centralizada aqui (RPC-only, regra de ouro 7).
      lifecycle: "CLIENTE",
      // S5-02: carimbo terminal da esteira comercial (histórico/visual). A saída
      // real da pipeline de leads é por lifecycle; este carimbo é só instantâneo.
      macrostatus_comercial: "GANHO",
    })
    .eq("id", caseId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new CaseServiceError(error?.message ?? "Falha ao liberar caso", 500);

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: caso.organization_id,
    action: "liberado_comercial",
    diff: { via: opts.via },
    triggered_by: opts.userId ?? null,
  });

  return { ok: true as const, id: caseId, case: data };
}

// ----------------------------------------------------------------------------
// S1-03 — PROMOÇÃO MANUAL lead→cliente (POR CASO).
// ----------------------------------------------------------------------------
// BUG CRÍTICO (R-ARCH-3): liberarCasoComercial faz NO-OP se aguardando_assinatura_at
// é NULL. Portanto NÃO reusamos a função crua — um LEAD sem procuração ZapSign
// nunca viraria CLIENTE. Aqui setamos lifecycle='CLIENTE' INDEPENDENTE da flag
// comercial. Escrita de lifecycle centralizada (RPC-only, regra de ouro 7).
//
// Auditoria (v2.2): qualquer usuário AUTENTICADO promove — só exigimos userId
// não-null (sem gate por cargo). Grava ator + timestamp em system_case_events.
export async function promoverCasoManual(caseId: string, userId: string) {
  if (!userId) throw new CaseServiceError("Ação exige usuário autenticado", 401);
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id, lifecycle, aguardando_assinatura_at, assinatura_liberada_at")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  // Idempotente: já CLIENTE → não faz novo UPDATE nem novo evento.
  if (caso.lifecycle === "CLIENTE") {
    return { ok: true as const, id: caseId, alreadyCliente: true };
  }

  // Respeita a invariante de S1-01 (assinatura_liberada_at NOT NULL ⇒ NOT LEAD):
  // ao promover, se o caso estava aguardando assinatura, limpamos a flag e
  // carimbamos assinatura_liberada_at; se não estava, só setamos lifecycle.
  // S5-02: carimba GANHO na esteira comercial (histórico/visual). A saída da
  // pipeline de leads é por lifecycle; o carimbo é só o instantâneo terminal.
  const patch: CaseUpdateRow = { lifecycle: "CLIENTE", macrostatus_comercial: "GANHO" };
  if (caso.aguardando_assinatura_at) {
    patch.aguardando_assinatura_at = null;
    patch.assinatura_liberada_at = caso.assinatura_liberada_at ?? new Date().toISOString();
    patch.assinatura_liberada_by = userId;
  }

  const { data, error } = await sb
    .from("system_cases")
    .update(patch)
    .eq("id", caseId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new CaseServiceError(error?.message ?? "Falha ao promover caso", 500);

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: caso.organization_id,
    action: "liberado_comercial",
    diff: { via: "manual" },
    triggered_by: userId,
  });

  return { ok: true as const, id: caseId, case: data };
}

// ----------------------------------------------------------------------------
// S1-03 / S1-01b — MARCAR CASO PERDIDO (LEAD→PERDIDO ou reversão CLIENTE→PERDIDO).
// ----------------------------------------------------------------------------
// Aceita origem LEAD e CLIENTE (S1-01b reversão pós-assinatura). Motivo é
// obrigatório. assinatura_liberada_at PERMANECE registrado (histórico) — o CHECK
// de S1-01 (assinatura_liberada_at NOT NULL ⇒ lifecycle <> 'LEAD') permite PERDIDO.
export async function marcarCasoPerdido(caseId: string, motivo: string, userId: string) {
  if (!userId) throw new CaseServiceError("Ação exige usuário autenticado", 401);
  const motivoTrim = (motivo ?? "").trim();
  if (!motivoTrim) throw new CaseServiceError("Informe o motivo da perda", 422);
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id, lifecycle")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  // Idempotente: já PERDIDO → não duplica.
  if (caso.lifecycle === "PERDIDO") {
    return { ok: true as const, id: caseId, alreadyPerdido: true };
  }

  const from = caso.lifecycle;

  const { data, error } = await sb
    .from("system_cases")
    .update({
      lifecycle: "PERDIDO",
      perdido_at: new Date().toISOString(),
      perdido_motivo: motivoTrim,
      // S5-02: carimbo terminal PERDIDO na esteira comercial (histórico/visual).
      // A saída da pipeline de leads é por lifecycle; este carimbo é só instantâneo.
      macrostatus_comercial: "PERDIDO",
    })
    .eq("id", caseId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new CaseServiceError(error?.message ?? "Falha ao marcar perdido", 500);

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: caso.organization_id,
    action: "perdido",
    diff: { motivo: motivoTrim, from },
    triggered_by: userId,
  });

  return { ok: true as const, id: caseId, case: data };
}

// ----------------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------------
export async function updateCase(id: string, input: CaseUpdateOutput, triggeredBy?: string) {
  const sb = getSupabaseAdmin();

  const { data: before } = await sb
    .from("system_cases")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!before) throw new CaseServiceError("Caso não encontrado", 404);

  const { data, error } = await sb
    .from("system_cases")
    .update(input)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) {
    throw new CaseServiceError(error?.message ?? "Falha ao atualizar", 500);
  }

  // Event: se mudou status, registra transition; senão, updated genérico
  const statusChanged =
    input.macrostatus_op !== undefined && input.macrostatus_op !== before.macrostatus_op;

  await sb.from("system_case_events").insert({
    case_id: id,
    organization_id: data.organization_id,
    action: statusChanged ? "status_changed" : "updated",
    from_macrostatus_op: statusChanged ? before.macrostatus_op : null,
    to_macrostatus_op: statusChanged ? data.macrostatus_op : null,
    diff: input,
    triggered_by: triggeredBy ?? null,
  });

  // S2-03 — instancia os itens de checklist da etapa de destino (idempotente,
  // server-side, dentro da transição). Falha aqui não deve derrubar o move.
  if (statusChanged && data.macrostatus_op) {
    await instanciarChecklist(id, data.macrostatus_op).catch(() => {});
  }

  return data;
}

// ----------------------------------------------------------------------------
// S2-07 — CAMPOS CANÔNICOS DO CASO (JSONB) — merge no canonical_fields.
// Distinto dos custom_fields de CLIENTE. Grava só em system_cases.
// ----------------------------------------------------------------------------
export async function updateCaseCanonicalFields(
  caseId: string,
  patch: Record<string, unknown>,
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();
  const { data: before } = await sb
    .from("system_cases")
    .select("canonical_fields, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!before) throw new CaseServiceError("Caso não encontrado", 404);

  const current = (before.canonical_fields as Record<string, unknown> | null) ?? {};
  const merged = { ...current, ...patch };
  // Remove chaves com valor vazio/null para não poluir o JSONB.
  for (const k of Object.keys(merged)) {
    const v = merged[k];
    if (v === null || v === undefined || v === "") delete merged[k];
  }

  const { data, error } = await sb
    .from("system_cases")
    .update({ canonical_fields: merged as never })
    .eq("id", caseId)
    .is("deleted_at", null)
    .select("id, canonical_fields")
    .single();
  if (error || !data)
    throw new CaseServiceError(error?.message ?? "Falha ao salvar campos do serviço", 500);

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: before.organization_id,
    action: "canonical_fields_updated",
    diff: patch as never,
    triggered_by: triggeredBy ?? null,
  });

  return data;
}

// ----------------------------------------------------------------------------
// SOFT-DELETE
// ----------------------------------------------------------------------------
export async function softDeleteCase(id: string, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_cases")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) throw new CaseServiceError("Caso não encontrado", 404);

  await sb.from("system_case_events").insert({
    case_id: id,
    organization_id: data.organization_id,
    action: "soft_deleted",
    triggered_by: triggeredBy ?? null,
  });
  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// MOVE STATUS (atalho usado pelo dialog Mover do Kanban operacional)
// ----------------------------------------------------------------------------
export async function moveCaseStatus(id: string, to: MacroOp, triggeredBy?: string) {
  return updateCase(id, { macrostatus_op: to }, triggeredBy);
}

// ----------------------------------------------------------------------------
// MOVE STATUS FIN (Kanban financeiro)
// ----------------------------------------------------------------------------
// Regra de negócio: voltar pra NAO_APLICAVEL é bloqueado — depois que o caso
// bifurcou, o rastro financeiro vive sua vida. Cancelar fin se necessário.
export async function moveCaseStatusFin(id: string, to: MacroFin, triggeredBy?: string) {
  const sb = getSupabaseAdmin();
  const { data: before } = await sb
    .from("system_cases")
    .select("macrostatus_fin")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!before) throw new CaseServiceError("Caso não encontrado", 404);

  if (to === "NAO_APLICAVEL" && before.macrostatus_fin !== "NAO_APLICAVEL") {
    throw new CaseServiceError(
      "Não é permitido voltar status financeiro pra 'Não aplicável'. Use 'Cancelado' se for o caso.",
      400,
    );
  }

  const { data, error } = await sb
    .from("system_cases")
    .update({ macrostatus_fin: to })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) {
    throw new CaseServiceError(error?.message ?? "Falha ao mover status fin", 500);
  }

  if (before.macrostatus_fin !== to) {
    await sb.from("system_case_events").insert({
      case_id: id,
      organization_id: data.organization_id,
      action: "fin_status_changed",
      diff: { from: before.macrostatus_fin, to },
      triggered_by: triggeredBy ?? null,
    });
    // S3-02 — instancia o checklist da etapa fin de destino (idempotente,
    // server-side) para o gate fin ter os itens da nova etapa.
    if (to !== "NAO_APLICAVEL") {
      await instanciarChecklist(id, to).catch(() => {});
    }
  }

  return data;
}

// ----------------------------------------------------------------------------
// CONFERÊNCIA FIN — gate manual "enviar para conferência" (S3-03)
// ----------------------------------------------------------------------------
// Move o card fin de fromSlug→toSlug (ex.: ELABORANDO→APROVACAO) e abre um estado
// de "pendente de aprovação" — a segunda pessoa aprova. DEFAULT = por EVENTO
// (sem coluna/tabela nova): o "pendente" é derivado do último evento
// 'fin_enviado_conferencia' sem 'fin_conferencia_aprovada' correspondente depois.
//
// Decisão do owner: SEM trava de cargo — qualquer usuário autenticado envia e
// aprova; a única restrição é segregação por ATOR (aprovador <> enviador),
// auditada em system_case_events. Preserva a trava NAO_APLICAVEL (via moveCaseStatusFin).

// Lê o estado de conferência derivado dos eventos (por evento, sem materializar).
// Retorna o último envio ainda pendente de aprovação (ou null).
export async function getConferenciaFinPendente(caseId: string): Promise<{
  from: string | null;
  to: string | null;
  enviado_por: string | null;
  enviado_at: string;
} | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_case_events")
    .select("action, diff, triggered_by, created_at")
    .eq("case_id", caseId)
    .in("action", ["fin_enviado_conferencia", "fin_conferencia_aprovada"])
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0];
  if (!last || last.action !== "fin_enviado_conferencia") return null;
  const diff = (last.diff ?? {}) as { from?: string | null; to?: string | null };
  return {
    from: diff.from ?? null,
    to: diff.to ?? null,
    enviado_por: last.triggered_by ?? null,
    enviado_at: last.created_at,
  };
}

// Enviar para conferência: move fromSlug→toSlug e registra o envio (ator=enviador).
// Reusa moveCaseStatusFin (dual-write + trava NAO_APLICAVEL + evento fin_status_changed),
// e grava adicionalmente o evento de conferência.
export async function enviarConferenciaFin(caseId: string, toSlug: MacroFin, triggeredBy?: string) {
  if (!triggeredBy) throw new CaseServiceError("Não autenticado", 401);
  const sb = getSupabaseAdmin();

  const { data: before } = await sb
    .from("system_cases")
    .select("macrostatus_fin, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!before) throw new CaseServiceError("Caso não encontrado", 404);
  if (before.macrostatus_fin === "NAO_APLICAVEL") {
    throw new CaseServiceError("Caso ainda não está no financeiro", 400);
  }
  const fromSlug = before.macrostatus_fin;

  // Move (respeita trava NAO_APLICAVEL e projeção via dual-write).
  await moveCaseStatusFin(caseId, toSlug, triggeredBy);

  // Evento de envio para conferência (ator = enviador). "Pendente" derivado deste.
  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: before.organization_id,
    action: "fin_enviado_conferencia",
    diff: { from: fromSlug, to: toSlug },
    triggered_by: triggeredBy,
  });

  return { ok: true as const, from: fromSlug, to: toSlug };
}

// Aprovar conferência: segunda pessoa confirma. Rejeita se aprovador == enviador
// (segregação por ator). Sem checagem de cargo.
export async function aprovarConferenciaFin(caseId: string, triggeredBy?: string) {
  if (!triggeredBy) throw new CaseServiceError("Não autenticado", 401);
  const sb = getSupabaseAdmin();

  const pendente = await getConferenciaFinPendente(caseId);
  if (!pendente) {
    throw new CaseServiceError("Não há conferência pendente para aprovar", 409);
  }
  if (pendente.enviado_por && pendente.enviado_por === triggeredBy) {
    throw new CaseServiceError(
      "A aprovação exige uma segunda pessoa — quem enviou para conferência não pode aprovar.",
      409,
    );
  }

  const { data: caso } = await sb
    .from("system_cases")
    .select("organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: caso.organization_id,
    action: "fin_conferencia_aprovada",
    diff: { from: pendente.from, to: pendente.to, enviado_por: pendente.enviado_por },
    triggered_by: triggeredBy,
  });

  return { ok: true as const };
}

// ----------------------------------------------------------------------------
// READ
// ----------------------------------------------------------------------------
export async function listCases(filters?: {
  search?: string;
  macrostatus_op?: MacroOp;
  macrostatus_fin?: MacroFin;
  client_id?: string;
}) {
  const sb = getSupabaseAdmin();
  let query = sb.from("system_cases_active").select("*").order("created_at", { ascending: false });

  if (filters?.macrostatus_op) {
    query = query.eq("macrostatus_op", filters.macrostatus_op);
  }
  if (filters?.macrostatus_fin) {
    query = query.eq("macrostatus_fin", filters.macrostatus_fin);
  }
  if (filters?.client_id) {
    query = query.eq("client_id", filters.client_id);
  }
  const searchTerm = filters?.search?.trim().replace(/[,()]/g, "") ?? "";
  if (searchTerm) {
    query = query.or(`case_code.ilike.%${searchTerm}%,proximo_passo.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query;
  if (error) throw new CaseServiceError(error.message, 500);
  const rows = data ?? [];

  // S2-07 — a busca por texto também cobre os campos canônicos do caso (JSONB).
  // PostgREST não faz ilike direto em jsonb, então buscamos os casos que têm
  // canonical_fields e filtramos por substring (case-insensitive) no servidor,
  // mesclando com o resultado do ilike em case_code/proximo_passo.
  if (searchTerm) {
    const needle = searchTerm.toLowerCase();
    const { data: withCanon } = await sb
      .from("system_cases_active")
      .select("*")
      .not("canonical_fields", "is", null)
      .order("created_at", { ascending: false });
    const seen = new Set(rows.map((r) => r.id));
    for (const r of withCanon ?? []) {
      if (seen.has(r.id)) continue;
      const text = JSON.stringify(r.canonical_fields ?? {}).toLowerCase();
      if (text.includes(needle)) rows.push(r);
    }
  }

  return rows;
}

export async function getCase(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("system_cases").select("*").eq("id", id).single();
  if (error || !data) throw new CaseServiceError("Caso não encontrado", 404);
  return data;
}

export async function listCaseEvents(caseId: string, limit = 50) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_events")
    .select("*, triggered_user:system_users!triggered_by(full_name)")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new CaseServiceError(error.message, 500);
  return (data ?? []).map((e) => ({
    ...e,
    triggered_by_name: (e.triggered_user as { full_name: string } | null)?.full_name ?? null,
    triggered_user: undefined,
  }));
}

// ----------------------------------------------------------------------------
// S4-04 — TIMELINE: entrada manual + read-only real dos eventos automáticos.
// ----------------------------------------------------------------------------
// Únicas `action` que a UI/RPC podem editar/apagar. Todo o resto (created,
// status_changed, liberado_comercial, avanços de etapa, docs, prazos, etc.) é
// evento AUTOMÁTICO do sistema → read-only real (bloqueio no servidor).
export const MANUAL_EVENT_ACTIONS = ["nota_manual", "marco"] as const;
export type ManualEventAction = (typeof MANUAL_EVENT_ACTIONS)[number];

function isManualAction(action: string): action is ManualEventAction {
  return (MANUAL_EVENT_ACTIONS as readonly string[]).includes(action);
}

// Adiciona um marco/nota manual à timeline do caso. Auth-only (ator não-null).
// `action` é livre no schema (sem CHECK) → sem migration.
export async function addManualCaseEvent(
  caseId: string,
  input: { action: ManualEventAction; body: string },
  userId: string,
) {
  if (!userId) throw new CaseServiceError("Ação exige usuário autenticado", 401);
  const body = (input.body ?? "").trim();
  if (!body) throw new CaseServiceError("Informe o texto do marco/nota", 422);
  if (!isManualAction(input.action)) {
    throw new CaseServiceError("Tipo de evento manual inválido", 422);
  }
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  const { data, error } = await sb
    .from("system_case_events")
    .insert({
      case_id: caseId,
      organization_id: caso.organization_id ?? DEFAULT_ORG_ID,
      action: input.action,
      diff: { body, manual: true },
      triggered_by: userId,
    })
    .select()
    .single();
  if (error || !data) {
    throw new CaseServiceError(error?.message ?? "Falha ao registrar evento manual", 500);
  }
  return data;
}

// Soft-guard: um evento só é editável/apagável se for MANUAL e do usuário. Os
// eventos automáticos do sistema são READ-ONLY reais — nunca podem ser tocados.
async function loadEditableManualEvent(eventId: string) {
  const sb = getSupabaseAdmin();
  const { data: event } = await sb
    .from("system_case_events")
    .select("id, case_id, action, triggered_by, diff")
    .eq("id", eventId)
    .single();
  if (!event) throw new CaseServiceError("Evento não encontrado", 404);
  if (!isManualAction(event.action) || !(event.diff as { manual?: boolean } | null)?.manual) {
    throw new CaseServiceError(
      "Eventos automáticos do sistema são somente-leitura e não podem ser editados ou removidos",
      403,
    );
  }
  return event;
}

// Edita um evento MANUAL (nunca automático). Read-only real no servidor.
export async function updateManualCaseEvent(eventId: string, body: string, userId: string) {
  if (!userId) throw new CaseServiceError("Ação exige usuário autenticado", 401);
  const text = (body ?? "").trim();
  if (!text) throw new CaseServiceError("Informe o texto do marco/nota", 422);
  const event = await loadEditableManualEvent(eventId);

  const sb = getSupabaseAdmin();
  const prevDiff = (event.diff as Record<string, unknown> | null) ?? {};
  const { data, error } = await sb
    .from("system_case_events")
    .update({ diff: { ...prevDiff, body: text, manual: true } })
    .eq("id", eventId)
    .select()
    .single();
  if (error || !data) throw new CaseServiceError(error?.message ?? "Falha ao editar evento", 500);
  return data;
}

// Remove (hard) um evento MANUAL — nunca um automático (read-only real). Eventos
// automáticos são histórico de auditoria e permanecem intocados.
export async function deleteManualCaseEvent(eventId: string, userId: string) {
  if (!userId) throw new CaseServiceError("Ação exige usuário autenticado", 401);
  await loadEditableManualEvent(eventId);

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("system_case_events").delete().eq("id", eventId);
  if (error) throw new CaseServiceError(error.message, 500);
  return { ok: true as const, id: eventId };
}
