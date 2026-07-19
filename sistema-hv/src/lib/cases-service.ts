// Server-only — CRUD de casos + timeline + audit.
// NUNCA importe no browser.

import { instanciarChecklist } from "./checklist-service";
import { enforceResponsavelIds, setCaseResponsaveis } from "./case-responsaveis-service";
import { getVisibleCaseIds } from "./visibility";
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
// case_code generator: {PREFIXO}-{YEAR}-{NNNN}
// ----------------------------------------------------------------------------
// Prefixo derivado do NOME da categoria (sem acento, maiúsculo, só letras/números).
// Antes usava caseType.split("_")[0] — o slug é legado (ex.: "Abatimento Militar"
// tem slug FIES_DGM), então o código saía "FIES" e colidia com FIES_ESF.
export function caseCodePrefix(nameOrSlug: string): string {
  const cleaned = (nameOrSlug ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // remove espaços, "/", "_", etc.
  return cleaned || "CASO";
}

// R2-05 — o prefixo do case_code deriva do NOME do TEMA quando o caso nasce por
// tema (dual-write). Como cada tema tem 1 service_type interno espelho (Opção 1,
// design R2-03) e `createServiceType` usou o NOME do tema, o nome do service_type
// interno JÁ é o nome do tema — então a resolução por `case_type`→service_type.name
// abaixo naturalmente rende o prefixo do tema. Quando `temaId` é informado,
// buscamos o nome direto em `system_temas` (fonte canônica) por robustez; senão
// caímos no nome do service_type pelo slug (categorias legadas). Só afeta casos
// NOVOS — códigos existentes NÃO são reescritos.
async function nextCaseCode(caseType: string, temaId?: string | null): Promise<string> {
  const sb = getSupabaseAdmin();
  // Busca o NOME da categoria pelo slug (o slug é imutável/legado; o nome é o que
  // o usuário vê e renomeia). Fallback: deriva do próprio slug.
  let prefix = caseCodePrefix(caseType);
  const { data: stRows } = await sb
    .from("system_service_types")
    .select("name")
    .eq("slug", caseType)
    .limit(1);
  const name = stRows?.[0]?.name;
  if (name) prefix = caseCodePrefix(name);

  // Prioridade ao NOME do TEMA (fonte canônica) quando o caso nasce por tema.
  if (temaId) {
    const { data: temaRow } = await sb
      .from("system_temas")
      .select("name")
      .eq("id", temaId)
      .limit(1)
      .maybeSingle();
    if (temaRow?.name) prefix = caseCodePrefix(temaRow.name);
  }

  const year = new Date().getFullYear();
  const { data, error } = await sb.rpc("nextval_seq_system_case_code");
  if (error) {
    const fallback = Date.now().toString().slice(-5);
    return `${prefix}-${year}-${fallback}`;
  }
  const n = typeof data === "number" ? data : Number(data ?? 0);
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
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

  // R2-05 — quando o caso nasce por TEMA, o motor continua sendo o service_type
  // INTERNO espelho do tema (Opção 1, design R2-03). Resolvemos server-side o slug
  // desse service_type e o usamos como `case_type` (fonte do dual-write: o trigger
  // deriva service_type_id do slug). Assim o front só precisa mandar `tema_id` —
  // não precisa conhecer o slug interno. Coexistência: sem `tema_id`, usa-se o
  // `case_type` recebido (caminho legado por categoria).
  let caseType = input.case_type;
  if (input.tema_id) {
    const { data: temaSt } = await sb
      .from("system_service_types")
      .select("slug")
      .eq("tema_id", input.tema_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!temaSt?.slug) {
      throw new CaseServiceError(
        "Tema sem pipeline configurada (service_type interno ausente). Recadastre o tema.",
        422,
      );
    }
    caseType = temaSt.slug;
  }

  const code = await nextCaseCode(caseType, input.tema_id);

  // Busca a primeira etapa operacional do service_type para não usar slug hardcoded
  let defaultOpStatus: string = input.macrostatus_op ?? "ONBOARDING";
  if (!input.macrostatus_op) {
    const { data: stType } = await sb
      .from("system_service_types")
      .select("id")
      .eq("slug", caseType)
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
  //
  // Cadastro exclusivo (2026-07-19) — atalho "criar já como CLIENTE": pula o funil
  // comercial e vai direto ao operacional (lifecycle='CLIENTE' + assinatura
  // liberada no próprio insert). Cliente e comercial são mutuamente exclusivos.
  const iniciarComoCliente = input.iniciar_como_cliente === true;
  const comercial = input.comercial === true && !iniciarComoCliente;

  // REGRA (2026-07-08) — criar/vincular um caso NÃO o coloca na pipeline
  // financeira. Reverte o AJUSTE B (2026-07-07), que semeava a 1ª etapa fin em
  // todo caso e fazia o lead cair no financeiro automaticamente. O caso só entra
  // no financeiro por ação MANUAL do usuário (system_fn_entrar_financeiro /
  // botão "Entrar no financeiro"). Respeita override explícito do caller.
  const defaultFinStatus: string = input.macrostatus_fin ?? "NAO_APLICAVEL";

  // S5-02: caso comercial entra na pipeline de leads na 1ª etapa comercial
  // (ordem 0) do seu tipo. Dual-write via macrostatus_comercial (a projeção
  // system_fn_sync_stage_ids preenche stage_comercial_id). Best-effort: se o tipo
  // não tiver esteira comercial semeada, o caso nasce sem etapa comercial.
  let defaultComercialStatus: string | null = null;
  if (comercial) {
    const { data: stTypeCom } = await sb
      .from("system_service_types")
      .select("id")
      .eq("slug", caseType)
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
      case_type: caseType,
      // R2-05 — dual-write TEMA→FRENTE (ADITIVO ao case_type/service_type_id, que
      // seguem governados pelo trigger). `tema_id` agrupa o caso na UI/relatórios
      // (Kanban/Lista por tema); `frente_slug` é a frente do tema (docs/checklist
      // puxam por ela — R2-04). Ambos NULL no caminho legado por categoria. O motor
      // (trigger system_fn_sync_stage_ids) segue resolvendo stage_op_id por
      // service_type_id derivado do case_type — NÃO tocado.
      tema_id: input.tema_id ?? null,
      frente_slug: input.frente_slug ?? null,
      macrostatus_op: defaultOpStatus,
      macrostatus_fin: defaultFinStatus,
      macrostatus_comercial: defaultComercialStatus,
      proximo_passo: input.proximo_passo ?? null,
      responsavel: input.responsavel ?? null,
      municipio: input.municipio ?? null,
      valor_centavos: input.valor_centavos ?? null,
      // ITEM 5 (2026-07-06): criar/vincular um caso deixa-o no COMERCIAL
      // (aguardando assinatura), NUNCA direto no operacional. Quando comercial=true,
      // carimba `aguardando_assinatura_at` — o Kanban operacional esconde casos com
      // essa flag, e eles aparecem no board COMERCIAL. A promoção para operacional
      // acontece por (a) assinatura (webhook/manual) ou (b) "Enviar para operacional".
      aguardando_assinatura_at: comercial ? new Date().toISOString() : null,
      // Cadastro exclusivo (2026-07-19) — nascer JÁ CLIENTE: carimba lifecycle e a
      // assinatura do contrato no ato (respeita o CHECK: assinatura_liberada_at
      // preenchido ⟹ lifecycle <> 'LEAD'). Assim a pessoa entra direto em Clientes.
      ...(iniciarComoCliente
        ? {
            lifecycle: "CLIENTE" as const,
            assinatura_liberada_at: new Date().toISOString(),
            assinatura_liberada_by: triggeredBy ?? null,
          }
        : {}),
      // (2026-07-09) — quem criou (base da visibilidade "meus casos").
      created_by: triggeredBy ?? null,
    })
    .select()
    .single();

  if (error || !created) {
    throw new CaseServiceError(error?.message ?? "Falha ao criar caso", 500);
  }

  // (2026-07-09) — vincula os responsáveis (advogados). Enforcement: se o criador
  // é advogado, ele é sempre o único responsável (não atribui a outros).
  {
    const enforced = await enforceResponsavelIds(triggeredBy, input.responsavelIds);
    if (enforced !== undefined) await setCaseResponsaveis(created.id, enforced, triggeredBy);
  }

  await sb.from("system_case_events").insert({
    case_id: created.id,
    organization_id: DEFAULT_ORG_ID,
    action: comercial ? "created_comercial" : iniciarComoCliente ? "created_cliente" : "created",
    to_macrostatus_op: created.macrostatus_op,
    diff: {
      case_type: created.case_type,
      client_id: created.client_id,
      comercial,
      iniciar_como_cliente: iniciarComoCliente,
    },
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
  // REGRA (2026-07-08) — criar um caso NÃO gera documento automático. O sistema
  // não cria rascunho de procuração/contrato sozinho: quem gera é o usuário, na
  // aba Documentos do caso (Procuração ou Documento do caso). Removida a antiga
  // preparação automática (ensureProcuracaoDocument/generateProcuracaoFromTemplate
  // no ato da criação). `opts.skipProcuracaoPrep` ficou sem efeito (mantido na
  // assinatura por compatibilidade dos callers). As funções de geração seguem
  // existindo e são chamadas pelos fluxos EXPLÍCITOS do usuário.
  void opts;

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
  // S9-09 — valores revisados na UI sobrescrevem o autofill server-side (mesma
  // semântica do "Gerar documento"). Opcional: sem eles, mantém o autofill.
  overrideValues?: Record<string, string>,
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
  const autofill = buildAutoFillValues(fields, data);
  // Valores revisados na UI têm prioridade sobre o autofill (só as chaves enviadas).
  const values = { ...autofill, ...(overrideValues ?? {}) };

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
// S9-02 — CONTRATO do caso (com modelo). Espelho de generateProcuracaoFromTemplate
// com doc_kind='contrato'. É o documento OPERACIONAL (contrato assinado ⇒ CLIENTE
// via webhook/gatilho S9-04/S9-05). NÃO envia ao ZapSign aqui — nasce em edição.
//
// Idempotência POR doc_kind='contrato' (procuração e contrato coexistem no mesmo
// caso — não podem colidir na busca de "já existe doc").
//
// Degradação gracioso: sem templateId ou template inexistente/apagado ⇒ 424
// (EXTERNAL_DEP_FAILED equivalente), mensagem clara ("Modelo de contrato ainda
// não cadastrado") — igual ao termo (S6-04). Nunca 5xx (Vercel mascara gateway).
// O caso NÃO é criado/alterado por essa falha.
// ----------------------------------------------------------------------------
export async function generateContratoFromTemplate(
  caseId: string,
  templateId: string | null | undefined,
  clientId: string,
  triggeredBy?: string,
  // S9-12 — valores revisados na UI sobrescrevem o autofill server-side (mesma
  // semântica de generateProcuracaoFromTemplate). Necessário para o documento
  // COMBINADO ("Contrato e procuração - [serviço]"), cujos campos são revisados
  // no mesmo diálogo antes do envio.
  overrideValues?: Record<string, string>,
) {
  const sb = getSupabaseAdmin();

  // Idempotente: se já existe CONTRATO no caso, não duplica (filtra por doc_kind).
  const { data: existing } = await sb
    .from("system_case_documents")
    .select("id")
    .eq("case_id", caseId)
    .eq("doc_kind", "contrato")
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return existing;

  // Sem template selecionado ⇒ degrada 424 (não 5xx).
  if (!templateId) {
    throw new CaseServiceError("Modelo de contrato ainda não cadastrado", 424);
  }

  const { data: tpl } = await sb
    .from("system_document_templates")
    .select("fields")
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();
  // Template apagado/inexistente ⇒ degrada 424.
  if (!tpl) {
    throw new CaseServiceError("Modelo de contrato ainda não cadastrado", 424);
  }

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

  const fields = ((tpl.fields ?? []) as TemplateField[]) ?? [];
  const data = buildAutoFillFromClient(client ?? {}, caso ?? {});
  const autofill = buildAutoFillValues(fields, data);
  // Valores revisados na UI têm prioridade sobre o autofill (só as chaves enviadas).
  const values = { ...autofill, ...(overrideValues ?? {}) };

  // Import dinâmico evita ciclo entre cases-service e case-documents-service.
  const { generateCaseDocumentFromTemplate } = await import("./case-documents-service");
  return generateCaseDocumentFromTemplate({
    caseId,
    templateId,
    values,
    docKind: "contrato",
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
  const cleaned = String(v)
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
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

  // 1.1) Entra no funil COMERCIAL (funil de entrada): carimba
  //      `aguardando_assinatura_at` → o caso passa a aparecer em
  //      listComercialCases e SOME do Kanban operacional (que esconde quem tem
  //      esse campo). O envio ao ZapSign continua sendo ação separada na ficha.
  await sb
    .from("system_cases")
    .update({ aguardando_assinatura_at: new Date().toISOString() })
    .eq("id", created.id)
    .is("aguardando_assinatura_at", null);

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

  // 3) Gera o documento EDITÁVEL (Google Docs) — NÃO finaliza aqui. O usuário
  //    valida/edita o "Word" na tela e só então finaliza (PDF na pasta do caso).
  //    A finalização + envio ao ZapSign são ações separadas (na ficha do caso ou
  //    no próprio diálogo de procuração). Import dinâmico evita ciclo.
  const { generateCaseDocumentFromTemplate } = await import("./case-documents-service");

  const gen = await generateCaseDocumentFromTemplate({
    caseId: created.id,
    templateId: input.templateId,
    values: finalValues,
    docKind: "procuracao",
    triggeredBy,
  });

  return { case: created, doc: gen.doc };
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
  const cases = data ?? [];
  if (cases.length === 0) return cases;

  // ITEM 3 (2026-07-07) — a aba "Assinaturas" (Comercial) deve listar SOMENTE
  // casos cujo documento foi de fato ENVIADO AO ZAPSIGN (status ENVIADO_ZAPSIGN
  // ou ASSINADO). Casos que apenas GERARAM o doc (RASCUNHO/EM_EDICAO/FINALIZADO)
  // NÃO aparecem aqui. `aguardando_assinatura_at` sozinho não basta: ele é
  // carimbado ao entrar no comercial (antes do envio ao ZapSign). ZapSign está
  // adiado, então a aba pode ficar vazia — o filtro é o que importa.
  const ids = cases.map((c) => c.id);
  const { data: sentDocs, error: docErr } = await sb
    .from("system_case_documents")
    .select("case_id")
    .in("case_id", ids)
    .in("status", ["ENVIADO_ZAPSIGN", "ASSINADO"])
    .is("deleted_at", null);
  if (docErr) throw new CaseServiceError(docErr.message, 500);
  const withSentDoc = new Set((sentDocs ?? []).map((d) => d.case_id));
  return cases.filter((c) => withSentDoc.has(c.id));
}

// ----------------------------------------------------------------------------
// ASSINATURAS (2026-07-08) — lista os DOCUMENTOS enviados ao ZapSign e ainda
// aguardando assinatura (status ENVIADO_ZAPSIGN). Granularidade por DOCUMENTO
// (não por caso) para a aba Assinaturas: cada linha é 1 documento com o botão
// "Confirmar assinatura". Só entra aqui o que foi de fato ENVIADO ao ZapSign.
// ----------------------------------------------------------------------------
export type ComercialDocument = {
  id: string;
  case_id: string | null;
  case_code: string;
  case_type: string | null;
  client_id: string | null;
  client_name: string;
  title: string;
  doc_kind: string | null;
  status: string;
  zapsign_sign_url: string | null;
  created_at: string;
};

export async function listComercialDocuments(): Promise<ComercialDocument[]> {
  const sb = getSupabaseAdmin();
  const { data: docs, error } = await sb
    .from("system_case_documents")
    .select("id, case_id, title, doc_kind, status, zapsign_sign_url, created_at")
    .eq("status", "ENVIADO_ZAPSIGN")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new CaseServiceError(error.message, 500);
  const rows = docs ?? [];
  if (rows.length === 0) return [];

  const caseIds = [...new Set(rows.map((d) => d.case_id).filter(Boolean))] as string[];
  const { data: cases } = await sb
    .from("system_cases_active")
    .select("id, case_code, client_id, case_type")
    .in("id", caseIds);
  const caseById = new Map((cases ?? []).map((c) => [c.id, c]));

  const clientIds = [...new Set((cases ?? []).map((c) => c.client_id).filter(Boolean))] as string[];
  const { data: clients } = clientIds.length
    ? await sb.from("system_clients").select("id, full_name").in("id", clientIds)
    : { data: [] as { id: string; full_name: string }[] };
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  return rows.map((d) => {
    const caso = d.case_id ? caseById.get(d.case_id) : undefined;
    const cli = caso?.client_id ? clientById.get(caso.client_id) : undefined;
    return {
      id: d.id,
      case_id: d.case_id,
      case_code: caso?.case_code ?? "—",
      case_type: caso?.case_type ?? null,
      client_id: caso?.client_id ?? null,
      client_name: cli?.full_name ?? "Cliente",
      title: d.title,
      doc_kind: d.doc_kind,
      status: d.status,
      zapsign_sign_url: d.zapsign_sign_url,
      created_at: d.created_at,
    };
  });
}

// ----------------------------------------------------------------------------
// S9-03 — GATILHO COMERCIAL: procuração assinada (webhook ou manual).
// ----------------------------------------------------------------------------
// MODELO NOVO (Sprint 9): procuração assinada = evento COMERCIAL. Carimba
// `procuracao_assinada_at`, sai de `aguardando_assinatura_at`, marca a esteira
// comercial como GANHO. NÃO muda `lifecycle` (o caso SEGUE LEAD) e NÃO carimba
// `assinatura_liberada_at` (isso é do CONTRATO — promoverCasoOperacional, S9-04).
// Isso permite 1 pessoa → N casos e a separação procuração/contrato.
// Escrita centralizada (RPC-only, regra de ouro 7). Idempotente.
export async function registrarProcuracaoAssinada(
  caseId: string,
  opts: { via: "webhook" | "manual"; userId?: string },
) {
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id, aguardando_assinatura_at, procuracao_assinada_at")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  // Idempotente: procuração já registrada e sem flag pendente → no-op (sem evento).
  if (!caso.aguardando_assinatura_at && caso.procuracao_assinada_at) {
    return { ok: true as const, id: caseId, alreadyLiberado: true };
  }

  const { data, error } = await sb
    .from("system_cases")
    .update({
      aguardando_assinatura_at: null,
      // Carimba só se ainda não estava (preserva o instante da 1ª assinatura).
      procuracao_assinada_at: caso.procuracao_assinada_at ?? new Date().toISOString(),
      // S5-02: carimbo terminal da esteira comercial (histórico/visual).
      macrostatus_comercial: "GANHO",
      // NÃO toca lifecycle (segue LEAD) nem assinatura_liberada_at (contrato).
    })
    .eq("id", caseId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new CaseServiceError(error?.message ?? "Falha ao registrar procuração", 500);

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: caso.organization_id,
    action: "procuracao_assinada",
    diff: { via: opts.via },
    triggered_by: opts.userId ?? null,
  });

  return { ok: true as const, id: caseId, case: data };
}

// Compat: alguns chamadores/integrações ainda referenciam o nome antigo. No
// modelo novo ele delega ao gatilho COMERCIAL (procuração ≠ promover a CLIENTE).
export const liberarCasoComercial = registrarProcuracaoAssinada;

// ----------------------------------------------------------------------------
// S9-04 — GATILHO OPERACIONAL: contrato do caso assinado ⇒ CLIENTE.
// ----------------------------------------------------------------------------
// MODELO NOVO (Sprint 9): SÓ o CONTRATO assinado promove o caso a CLIENTE.
// Carimba `assinatura_liberada_at` (= contrato, redefinido em S9-01) + `_by`,
// seta `lifecycle='CLIENTE'` e `macrostatus_comercial='GANHO'` (terminal
// comercial). A entrada operacional→financeira segue a máquina existente
// (bifurcação/entrar_financeiro; o caso já nasce na 1ª etapa op no createCase) —
// NÃO recria trigger de bifurcação (regra de ouro 6). Escrita centralizada
// (RPC-only, regra de ouro 7). Idempotente (no-op se já CLIENTE).
//
// CUIDADO com o CHECK de S9-01 (assinatura_liberada_at NOT NULL ⇒ NOT LEAD):
// setamos lifecycle='CLIENTE' + assinatura_liberada_at no MESMO patch.
export async function promoverCasoOperacional(
  caseId: string,
  opts: { via: "webhook" | "manual"; userId: string },
) {
  if (!opts.userId) throw new CaseServiceError("Ação exige usuário autenticado", 401);
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select(
      "id, organization_id, lifecycle, aguardando_assinatura_at, assinatura_liberada_at, macrostatus_op, service_type_id",
    )
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  // Idempotente: já CLIENTE → não faz novo UPDATE nem novo evento.
  if (caso.lifecycle === "CLIENTE") {
    return { ok: true as const, id: caseId, alreadyCliente: true };
  }

  // Contrato assinado ⇒ CLIENTE + assinatura_liberada_at (só se NULL) no MESMO
  // patch (o CHECK de S9-01 exige NOT LEAD sempre que assinatura_liberada_at
  // estiver setado). Limpa a flag comercial se ainda estiver pendente.
  const patch: CaseUpdateRow = {
    lifecycle: "CLIENTE",
    macrostatus_comercial: "GANHO",
    assinatura_liberada_at: caso.assinatura_liberada_at ?? new Date().toISOString(),
    assinatura_liberada_by: opts.userId,
  };
  if (caso.aguardando_assinatura_at) {
    patch.aguardando_assinatura_at = null;
  }

  // ITEM 2b (2026-07-07) — o caso promovido deve cair na 1ª etapa OPERACIONAL do
  // TIPO dele. Normalmente já nasce lá (createCase), então isto é defensivo: só
  // corrige se `macrostatus_op` estiver NULO. Se já estiver numa etapa op válida
  // (ex.: movido manualmente pra frente), NÃO regride — preserva o progresso.
  if (!caso.macrostatus_op && (caso as { service_type_id?: string | null }).service_type_id) {
    const { data: firstOpStage } = await sb
      .from("system_pipeline_stages")
      .select("slug")
      .eq("service_type_id", (caso as { service_type_id: string }).service_type_id)
      .eq("kind", "op")
      .is("deleted_at", null)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstOpStage?.slug) {
      patch.macrostatus_op = firstOpStage.slug;
    }
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
    action: "contrato_assinado",
    diff: { via: opts.via },
    triggered_by: opts.userId,
  });

  return { ok: true as const, id: caseId, case: data };
}

// ----------------------------------------------------------------------------
// S1-03 — PROMOÇÃO MANUAL lead→cliente (POR CASO). Botão da ficha do caso.
// ----------------------------------------------------------------------------
// S9-04: delega ao gatilho operacional (promoverCasoOperacional). Mantém a
// assinatura pública consumida por promoverCasoManualFn (src/rpc/cases.ts) e o
// shape de retorno (`alreadyCliente`). Auditoria: exige userId não-null (401 sem).
export async function promoverCasoManual(caseId: string, userId: string) {
  if (!userId) throw new CaseServiceError("Ação exige usuário autenticado", 401);
  return promoverCasoOperacional(caseId, { via: "manual", userId });
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

  // responsavelIds não é coluna — trata à parte (vínculo N:N + cache de exibição).
  const { responsavelIds, ...dbInput } = input as CaseUpdateOutput & { responsavelIds?: string[] };

  const { data, error } = await sb
    .from("system_cases")
    .update(dbInput)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) {
    throw new CaseServiceError(error?.message ?? "Falha ao atualizar", 500);
  }

  if (responsavelIds !== undefined) {
    const ids = await enforceResponsavelIds(triggeredBy, responsavelIds);
    await setCaseResponsaveis(id, ids ?? [], triggeredBy);
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

  // (2026-07-09) — checklist é SÓ do financeiro. Mudança de etapa OPERACIONAL não
  // instancia checklist. (No fin, a instanciação segue em moveCaseToStageFin /
  // entrarNoFinanceiro.)

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
// R2 — VINCULAR CASO EXISTENTE a um TEMA (mover caso p/ o tema).
// ----------------------------------------------------------------------------
// Opção 1 (design R2-03): cada TEMA tem um service_type INTERNO espelho 1:1
// (getTemaServiceType). O motor (trigger system_fn_sync_stage_ids, checklist,
// Kanban) roda por `service_type_id`, que é derivado de `case_type` (slug). Então
// vincular = reatribuir o `case_type` do caso ao slug do service_type interno do
// tema + gravar `tema_id`/`frente_slug` (ADITIVOS). DUAL-WRITE VIVO: nunca
// apagamos case_type/macrostatus_* — só reatribuímos.
//
// macrostatus_op (evitar órfão de etapa): o service_type mudou, então a etapa op
// atual pode não existir na nova pipeline. Regra: se o slug de `macrostatus_op`
// EXISTE em system_pipeline_stages do service_type interno (kind='op', ativo) →
// mantém (preserva progresso). Se NÃO existe → reseta para a 1ª etapa op (menor
// `ordem`). Idem para `macrostatus_fin` — mas só quando o caso já bifurcou
// (macrostatus_fin <> 'NAO_APLICAVEL'); se NAO_APLICAVEL, deixa como está (o caso
// não está no financeiro). O trigger reprojeta service_type_id/stage_op_id a
// partir de case_type/macrostatus_op — NÃO tocado.
export async function moverCasoParaTema(
  caseId: string,
  temaId: string,
  frenteSlug?: string | null,
  triggeredBy?: string,
) {
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, organization_id, case_type, tema_id, frente_slug, macrostatus_op, macrostatus_fin")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();
  if (!caso) throw new CaseServiceError("Caso não encontrado", 404);

  // Resolve o service_type INTERNO (motor) do tema (Opção 1, 1:1).
  const { data: temaSt } = await sb
    .from("system_service_types")
    .select("id, slug")
    .eq("tema_id", temaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!temaSt?.slug || !temaSt.id) {
    throw new CaseServiceError(
      "Tema sem pipeline configurada (service_type interno ausente). Recadastre o tema.",
      422,
    );
  }
  const newCaseType = temaSt.slug;
  const serviceTypeId = temaSt.id;

  // Etapas op (ativas) do service_type interno — p/ decidir manter vs resetar.
  const { data: opStages } = await sb
    .from("system_pipeline_stages")
    .select("slug, ordem")
    .eq("service_type_id", serviceTypeId)
    .eq("kind", "op")
    .is("deleted_at", null)
    .order("ordem", { ascending: true });
  const opSlugs = new Set((opStages ?? []).map((s) => s.slug));
  const firstOpSlug = opStages?.[0]?.slug ?? null;

  // macrostatus_op: mantém se existe na nova pipeline; senão reseta p/ a 1ª etapa.
  const opResetado = !!caso.macrostatus_op && !opSlugs.has(caso.macrostatus_op);
  const newMacroOp =
    caso.macrostatus_op && opSlugs.has(caso.macrostatus_op)
      ? caso.macrostatus_op
      : (firstOpSlug ?? caso.macrostatus_op);

  // macrostatus_fin: só reprojeta se o caso já bifurcou (<> NAO_APLICAVEL). Se
  // NAO_APLICAVEL, mantém — o caso não está no financeiro. Se bifurcado e a etapa
  // fin não existir na nova pipeline, reseta p/ a 1ª etapa fin.
  let newMacroFin = caso.macrostatus_fin;
  let finResetado = false;
  if (caso.macrostatus_fin && caso.macrostatus_fin !== "NAO_APLICAVEL") {
    const { data: finStages } = await sb
      .from("system_pipeline_stages")
      .select("slug, ordem")
      .eq("service_type_id", serviceTypeId)
      .eq("kind", "fin")
      .is("deleted_at", null)
      .order("ordem", { ascending: true });
    const finSlugs = new Set((finStages ?? []).map((s) => s.slug));
    if (!finSlugs.has(caso.macrostatus_fin)) {
      const firstFinSlug = finStages?.[0]?.slug ?? null;
      if (firstFinSlug) {
        newMacroFin = firstFinSlug;
        finResetado = true;
      }
    }
  }

  // Reatribui (nunca apaga) case_type/macrostatus_* + grava tema_id/frente_slug.
  // service_type_id = null é OBRIGATÓRIO: o trigger system_fn_sync_stage_ids só
  // reprojeta service_type_id quando ele é NULL (IF NEW.service_type_id IS NULL).
  // Como aqui o caso MUDA de tipo, sem zerar o service_type_id o trigger manteria
  // o tipo antigo (stale) e resolveria stage_op_id = NULL (órfão de etapa, caso
  // some do Kanban). Zerando, o trigger reprojeta service_type_id (do novo
  // case_type) e daí stage_op_id — dual-write correto.
  const patch: CaseUpdateRow = {
    case_type: newCaseType,
    service_type_id: null,
    tema_id: temaId,
    frente_slug: frenteSlug ?? null,
    macrostatus_op: newMacroOp,
    macrostatus_fin: newMacroFin,
  };

  const { data, error } = await sb
    .from("system_cases")
    .update(patch)
    .eq("id", caseId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data) {
    throw new CaseServiceError(error?.message ?? "Falha ao vincular caso ao tema", 500);
  }

  await sb.from("system_case_events").insert({
    case_id: caseId,
    organization_id: caso.organization_id,
    action: "vinculado_a_tema",
    diff: {
      tema_id: temaId,
      frente_slug: frenteSlug ?? null,
      from_case_type: caso.case_type,
      to_case_type: newCaseType,
      op_resetado: opResetado,
      fin_resetado: finResetado,
      from_macrostatus_op: caso.macrostatus_op,
      to_macrostatus_op: newMacroOp,
    },
    triggered_by: triggeredBy ?? null,
  });

  return { case: data, opResetado, finResetado };
}

// ----------------------------------------------------------------------------
// MOVE STATUS (atalho usado pelo dialog Mover do Kanban operacional)
// ----------------------------------------------------------------------------
// `to` é o SLUG da etapa op (configurável por categoria) — texto livre desde a
// migration 0017. O trigger system_fn_sync_stage_ids reaponta stage_op_id.
export async function moveCaseStatus(id: string, to: string, triggeredBy?: string) {
  // Cast: macrostatus_op é texto livre no banco (etapas por categoria), mas o tipo
  // do patch ainda usa o enum legado MacroOp. O trigger reaponta stage_op_id.
  return updateCase(id, { macrostatus_op: to as MacroOp }, triggeredBy);
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
export async function listCases(
  filters?: {
    search?: string;
    macrostatus_op?: MacroOp;
    macrostatus_fin?: MacroFin;
    client_id?: string;
  },
  viewerUserId?: string,
) {
  const sb = getSupabaseAdmin();
  // Visibilidade: advogado vê só os casos vinculados a ele; admin vê tudo.
  const visible = await getVisibleCaseIds(viewerUserId);
  if (visible !== null && visible.length === 0) return [];

  let query = sb.from("system_cases_active").select("*").order("created_at", { ascending: false });
  if (visible !== null) query = query.in("id", visible);

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
    let canonQ = sb
      .from("system_cases_active")
      .select("*")
      .not("canonical_fields", "is", null)
      .order("created_at", { ascending: false });
    if (visible !== null) canonQ = canonQ.in("id", visible);
    const { data: withCanon } = await canonQ;
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
