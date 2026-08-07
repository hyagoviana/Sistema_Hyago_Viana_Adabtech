// Server-only — orquestra o fluxo de integração n8n → Supabase + Drive.
// NUNCA importe em código que roda no browser.
//
// Fluxo (Opção A — o n8n CHAMA este endpoint em vez de escrever cru no Supabase):
//   1. n8n recebe o e-mail do ZapSign/Zaping (procuração assinada)
//   2. Sobe o PDF assinado ao Drive e chama este webhook com os dados do cliente
//      + processo + referência do documento assinado (assinado=true)
//   3. Busca cliente por CPF/CNPJ → se não existe, cria + pasta no Drive
//   4. Busca caso pelo tipo + cliente → se não existe, cria na 1ª etapa op do tipo
//   5. Cria subpasta do caso dentro da pasta do cliente no Drive
//   6. Se veio documento assinado (PROCURAÇÃO):
//        a. grava system_case_documents (doc_kind='procuracao', status='ASSINADO')
//        b. REGISTRA a procuração assinada (registrarProcuracaoAssinada — evento
//           COMERCIAL). O caso SEGUE LEAD (S9-06). A promoção a CLIENTE agora é
//           SÓ por CONTRATO assinado (promoverCasoOperacional / webhook ZapSign).
//        c. registra o consentimento LGPD (system_consent_records)
//   7. Retorna IDs para o n8n continuar o fluxo
//
// Retrocompatível: sem documento assinado, o caso é criado na 1ª etapa op e
// permanece LEAD (comportamento antigo de onboarding).
//
// Idempotência: find-or-create por CPF/CNPJ (cliente) e por tipo+cliente (caso);
// o documento assinado é deduplicado por dedupe-key (drive_file_id) e por caso.

import slugify from "slugify";

import { registrarProcuracaoAssinada } from "./cases-service";
import { createFolder, DriveError, uploadFile } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";
import { recordConsent } from "./users-service";
import { sanitizeCpfCnpj } from "./validators/client";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class N8nWebhookError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "N8nWebhookError";
  }
}

// ----------------------------------------------------------------------------
// Payload que o n8n envia
// ----------------------------------------------------------------------------
export interface N8nIncomingPayload {
  // Cliente
  nome_cliente: string;
  cpf_cnpj: string;
  email?: string | null;
  telefone?: string | null;

  // Processo
  tipo_processo: string; // ex: "FIES_ESF", "COVID", etc. (slug do service_type)
  numero_processo?: string | null;
  municipio?: string | null;
  responsavel?: string | null;
  proximo_passo?: string | null;

  // Documento (legado — apenas referência de URL solta, sem persistir no caso)
  documento_nome?: string | null;
  documento_url?: string | null;

  // Documento assinado (ZapSign). Quando `assinado=true`, o caso é PROMOVIDO a
  // CLIENTE e o PDF é gravado como procuração ASSINADA na pasta do caso.
  // O n8n é responsável por subir o PDF ao Drive ANTES de chamar este webhook e
  // passar aqui o drive_file_id/drive_url (preferido). Se só tiver a URL pública
  // do ZapSign, informe `signed_file_url` que o app baixa e sobe na pasta do caso.
  assinado?: boolean;
  documento_assinado?: {
    drive_file_id?: string | null; // preferido: PDF já no Drive (n8n subiu)
    drive_url?: string | null;
    signed_file_url?: string | null; // alternativa: URL do PDF assinado p/ o app baixar
    name?: string | null; // título do documento (default: "Procuração")
    zapsign_doc_token?: string | null; // token do doc no ZapSign (rastreio/dedupe)
  } | null;
}

// ----------------------------------------------------------------------------
// Resposta devolvida ao n8n
// ----------------------------------------------------------------------------
export interface N8nWebhookResult {
  cliente_id: string;
  cliente_nome: string;
  cliente_criado: boolean;
  cliente_drive_folder_id: string | null;

  caso_id: string;
  caso_code: string;
  caso_criado: boolean;
  caso_drive_folder_id: string | null;

  // Documento assinado (quando assinado=true)
  documento_assinado_id: string | null;
  documento_assinado_criado: boolean;
  caso_promovido: boolean; // virou CLIENTE nesta chamada
  caso_lifecycle: string; // 'LEAD' | 'CLIENTE' | ...
  consentimento_registrado: boolean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function clientsParentFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID;
  if (!id) {
    throw new N8nWebhookError("GOOGLE_DRIVE_CLIENTS_FOLDER_ID ausente no .env", 500);
  }
  return id;
}

function buildClientFolderName(fullName: string, cpfCnpj: string): string {
  const slug = slugify(fullName, { lower: true, strict: true, locale: "pt" });
  return `${slug}-${cpfCnpj}`;
}

function buildCaseFolderName(caseCode: string, caseType: string): string {
  return `${caseCode} - ${caseType}`;
}

// Ator do sistema (super-admin da org) para promover o caso de forma auditada.
// O onboarding do n8n é automático — não há usuário humano no laço, então usamos
// o admin da org como ator auditável do evento. promoverCasoManual exige userId
// não-nulo; se não houver admin, retorna null e a promoção é pulada (best-effort).
async function resolveSystemActorId(): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_users")
    .select("id")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("role", "admin")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// ----------------------------------------------------------------------------
// Gerar case_code (mesmo padrão do cases-service)
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

// Resolve a 1ª etapa OPERACIONAL válida do pipeline do tipo. NÃO usa slug fixo
// (o antigo 'ONBOARDING' hardcoded podia não existir na pipeline do tipo). Cai
// em 'ONBOARDING' apenas como último recurso (retrocompatibilidade).
async function resolveFirstOpStage(caseType: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data: stType } = await sb
    .from("system_service_types")
    .select("id")
    .eq("slug", caseType)
    .is("deleted_at", null)
    .maybeSingle();
  if (stType) {
    const { data: firstOpStage } = await sb
      .from("system_pipeline_stages")
      .select("slug")
      .eq("service_type_id", stType.id)
      .eq("kind", "op")
      .is("deleted_at", null)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstOpStage?.slug) return firstOpStage.slug;
  }
  return "ONBOARDING";
}

// ----------------------------------------------------------------------------
// MAIN: processar payload do n8n
// ----------------------------------------------------------------------------
export async function processN8nWebhook(payload: N8nIncomingPayload): Promise<N8nWebhookResult> {
  const sb = getSupabaseAdmin();

  // Validação básica
  if (!payload.nome_cliente?.trim()) {
    throw new N8nWebhookError("nome_cliente é obrigatório", 400);
  }
  if (!payload.cpf_cnpj?.trim()) {
    throw new N8nWebhookError("cpf_cnpj é obrigatório", 400);
  }
  if (!payload.tipo_processo?.trim()) {
    throw new N8nWebhookError("tipo_processo é obrigatório", 400);
  }

  const cpfCnpjClean = sanitizeCpfCnpj(payload.cpf_cnpj);

  // =========================================================================
  // 1) BUSCAR OU CRIAR CLIENTE
  // =========================================================================
  let clienteCriado = false;

  // Buscar por CPF/CNPJ (ativo)
  const { data: existingClient } = await sb
    .from("system_clients")
    .select("*")
    .eq("cpf_cnpj", cpfCnpjClean)
    .eq("organization_id", DEFAULT_ORG_ID)
    .is("deleted_at", null)
    .maybeSingle();

  let cliente = existingClient;

  if (!cliente) {
    // Criar cliente
    const { data: newClient, error: insertErr } = await sb
      .from("system_clients")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        full_name: payload.nome_cliente.trim(),
        cpf_cnpj: cpfCnpjClean,
        email: payload.email?.trim() || null,
        phone: payload.telefone?.replace(/\D/g, "") || null,
      })
      .select()
      .single();

    if (insertErr) {
      // Se deu duplicata (race condition), buscar de novo
      if (insertErr.code === "23505") {
        const { data: retry } = await sb
          .from("system_clients")
          .select("*")
          .eq("cpf_cnpj", cpfCnpjClean)
          .eq("organization_id", DEFAULT_ORG_ID)
          .is("deleted_at", null)
          .single();
        if (!retry) {
          throw new N8nWebhookError(`Falha ao criar/buscar cliente: ${insertErr.message}`, 500);
        }
        cliente = retry;
      } else {
        throw new N8nWebhookError(`Erro ao criar cliente: ${insertErr.message}`, 500);
      }
    } else {
      cliente = newClient!;
      clienteCriado = true;

      // Audit
      await sb.from("system_audit_log").insert({
        organization_id: DEFAULT_ORG_ID,
        action: "client.create",
        entity_type: "client",
        entity_id: cliente.id,
        diff: { source: "n8n_webhook", nome: payload.nome_cliente },
      });
    }
  }

  // =========================================================================
  // 2) GARANTIR PASTA DO CLIENTE NO DRIVE
  // =========================================================================
  if (!cliente.drive_folder_id) {
    const folderName = buildClientFolderName(cliente.full_name, cliente.cpf_cnpj);
    try {
      const folder = await createFolder(folderName, clientsParentFolderId());
      await sb
        .from("system_clients")
        .update({
          drive_folder_id: folder.id,
          drive_folder_url: folder.url,
          drive_sync_failed: false,
          drive_sync_error: null,
        })
        .eq("id", cliente.id);
      cliente = { ...cliente, drive_folder_id: folder.id, drive_folder_url: folder.url };
    } catch (err) {
      const msg =
        err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
      await sb
        .from("system_clients")
        .update({ drive_sync_failed: true, drive_sync_error: msg.slice(0, 2000) })
        .eq("id", cliente.id);
      console.error("n8n-webhook: falha ao criar pasta do cliente no Drive:", msg);
    }
  }

  // =========================================================================
  // 3) BUSCAR OU CRIAR CASO (PROCESSO)
  // =========================================================================
  let casoCriado = false;

  // Buscar caso existente do mesmo tipo para este cliente
  const { data: existingCase } = await sb
    .from("system_cases")
    .select("*")
    .eq("client_id", cliente.id)
    .eq("case_type", payload.tipo_processo)
    .eq("organization_id", DEFAULT_ORG_ID)
    .is("deleted_at", null)
    .maybeSingle();

  let caso = existingCase;

  if (!caso) {
    const caseCode = await nextCaseCode(payload.tipo_processo);
    // Resolve a 1ª etapa op do pipeline do tipo (não usa slug hardcoded).
    const firstOpStage = await resolveFirstOpStage(payload.tipo_processo);

    const { data: newCase, error: caseErr } = await sb
      .from("system_cases")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        client_id: cliente.id,
        case_code: caseCode,
        case_type: payload.tipo_processo,
        macrostatus_op: firstOpStage,
        macrostatus_fin: "NAO_APLICAVEL",
        proximo_passo: payload.proximo_passo?.trim() || null,
        responsavel: payload.responsavel?.trim() || null,
        municipio: payload.municipio?.trim() || null,
        // lifecycle NÃO é setado aqui — nasce 'LEAD' (default da coluna). Na
        // procuração assinada o caso SEGUE LEAD (S9-06); a promoção a CLIENTE é
        // só por CONTRATO assinado (promoverCasoOperacional / webhook ZapSign).
      })
      .select()
      .single();

    if (caseErr || !newCase) {
      throw new N8nWebhookError(`Erro ao criar caso: ${caseErr?.message ?? "unknown"}`, 500);
    }

    caso = newCase;
    casoCriado = true;

    // Event de criação
    await sb.from("system_case_events").insert({
      case_id: caso.id,
      organization_id: DEFAULT_ORG_ID,
      action: "created",
      to_macrostatus_op: caso.macrostatus_op,
      diff: {
        source: "n8n_webhook",
        case_type: caso.case_type,
        client_id: cliente.id,
      },
    });
  }

  // =========================================================================
  // 4) GARANTIR SUBPASTA DO CASO NO DRIVE (dentro da pasta do cliente)
  // =========================================================================
  if (!caso.drive_folder_id && cliente.drive_folder_id) {
    const caseFolderName = buildCaseFolderName(caso.case_code, caso.case_type);
    try {
      const caseFolder = await createFolder(caseFolderName, cliente.drive_folder_id);
      await sb
        .from("system_cases")
        .update({
          drive_folder_id: caseFolder.id,
          drive_folder_url: caseFolder.url,
        })
        .eq("id", caso.id);
      caso = { ...caso, drive_folder_id: caseFolder.id, drive_folder_url: caseFolder.url };
    } catch (err) {
      const msg =
        err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
      console.error("n8n-webhook: falha ao criar subpasta do caso no Drive:", msg);
    }
  }

  // =========================================================================
  // 5) DOCUMENTO ASSINADO → grava procuração ASSINADA + promove + LGPD
  // =========================================================================
  let documentoAssinadoId: string | null = null;
  let documentoAssinadoCriado = false;
  let casoPromovido = false;
  let consentimentoRegistrado = false;
  let casoLifecycle: string = (caso as { lifecycle?: string | null }).lifecycle ?? "LEAD";

  const assinado = payload.assinado === true && !!payload.documento_assinado;

  if (assinado) {
    const docRef = payload.documento_assinado!;
    const docTitle = docRef.name?.trim() || "Procuração";

    // 5.a) Idempotência do DOCUMENTO: já existe procuração ASSINADA neste caso?
    // Chave preferida: zapsign_doc_token; senão, qualquer procuracao ASSINADO do caso.
    const { data: existingDoc } = await sb
      .from("system_case_documents")
      .select("id, status, drive_file_id, drive_url")
      .eq("case_id", caso.id)
      .eq("doc_kind", "procuracao")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const jaAssinado = existingDoc?.status === "ASSINADO";

    if (jaAssinado && existingDoc) {
      // Reprocessamento: NÃO duplica doc nem sobe PDF de novo.
      documentoAssinadoId = existingDoc.id;
    } else {
      // Resolve o PDF: preferimos o drive_file_id já subido pelo n8n. Se só veio a
      // URL pública do PDF assinado, o app baixa e sobe na pasta do caso.
      let driveFileId = docRef.drive_file_id ?? null;
      let driveUrl = docRef.drive_url ?? null;

      if (!driveFileId && docRef.signed_file_url) {
        try {
          const res = await fetch(docRef.signed_file_url);
          if (!res.ok) {
            throw new N8nWebhookError(`Falha ao baixar signed_file_url (${res.status})`, 424);
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          const parentId = caso.drive_folder_id;
          if (!parentId) {
            throw new N8nWebhookError(
              "Caso sem pasta no Drive · não foi possível armazenar o PDF assinado",
              424,
            );
          }
          const file = await uploadFile({
            parentId,
            name: `assinado-${docTitle}.pdf`,
            mimeType: "application/pdf",
            body: buffer,
          });
          driveFileId = file.id;
          driveUrl = file.url;
        } catch (err) {
          if (err instanceof N8nWebhookError) throw err;
          const msg =
            err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
          throw new N8nWebhookError(`Falha ao armazenar PDF assinado: ${msg}`, 424);
        }
      }

      if (existingDoc) {
        // Já havia uma procuração (placeholder/enviada) no caso — atualiza p/ ASSINADO.
        const { data: upd } = await sb
          .from("system_case_documents")
          .update({
            status: "ASSINADO",
            drive_file_id: driveFileId ?? existingDoc.drive_file_id,
            drive_url: driveUrl ?? existingDoc.drive_url,
            ...(docRef.zapsign_doc_token ? { zapsign_doc_token: docRef.zapsign_doc_token } : {}),
          })
          .eq("id", existingDoc.id)
          .select("id")
          .single();
        documentoAssinadoId = upd?.id ?? existingDoc.id;
      } else {
        // Cria o registro da procuração ASSINADA (padrão de case-documents-service).
        const { data: newDoc, error: docErr } = await sb
          .from("system_case_documents")
          .insert({
            case_id: caso.id,
            organization_id: caso.organization_id,
            title: docTitle,
            status: "ASSINADO",
            source: "GERADO",
            doc_kind: "procuracao",
            goes_to_zapsign: true,
            drive_file_id: driveFileId,
            drive_url: driveUrl,
            mime_type: "application/pdf",
            ...(docRef.zapsign_doc_token ? { zapsign_doc_token: docRef.zapsign_doc_token } : {}),
          })
          .select("id")
          .single();
        if (docErr || !newDoc) {
          throw new N8nWebhookError(
            `Falha ao gravar procuração assinada: ${docErr?.message ?? "?"}`,
            500,
          );
        }
        documentoAssinadoId = newDoc.id;
        documentoAssinadoCriado = true;
      }

      await sb.from("system_audit_log").insert({
        organization_id: caso.organization_id,
        action: "case_document.signed_received",
        entity_type: "case_document",
        entity_id: documentoAssinadoId,
        diff: {
          source: "n8n_webhook",
          zapsign_doc_token: docRef.zapsign_doc_token ?? null,
          drive_file_id: driveFileId,
        },
      });

      await sb.from("system_case_events").insert({
        case_id: caso.id,
        organization_id: caso.organization_id,
        action: "doc_signed_received",
        diff: { source: "n8n_webhook", doc_id: documentoAssinadoId, doc_title: docTitle },
      });
    }

    // 5.b) S9-06: procuração assinada = evento COMERCIAL (registra, NÃO promove).
    // O caso SEGUE LEAD; a promoção a CLIENTE agora é SÓ por contrato assinado.
    // Auditado (registrarProcuracaoAssinada grava evento). Best-effort/idempotente.
    try {
      const actorId = await resolveSystemActorId();
      await registrarProcuracaoAssinada(caso.id, {
        via: "webhook",
        userId: actorId ?? undefined,
      });
      // caso_promovido permanece false (procuração não promove); lifecycle segue LEAD.
      casoPromovido = false;
      casoLifecycle = "LEAD";
    } catch (err) {
      // Best-effort: falha ao registrar não deve perder o doc já gravado. Loga e segue.
      console.error("n8n-webhook: falha ao registrar procuração assinada:", err);
    }

    // 5.c) Registrar consentimento LGPD (best-effort). Idempotência simples: só
    // grava se ainda não houver consentimento ativo para este cliente.
    try {
      const { data: consentExistente } = await sb
        .from("system_consent_records")
        .select("id")
        .eq("client_id", cliente.id)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle();
      if (!consentExistente) {
        await recordConsent({
          client_id: cliente.id,
          cpf_cnpj: cliente.cpf_cnpj,
          finalidade: "prestacao_servico_juridico",
          channel: "WHATSAPP",
        });
        consentimentoRegistrado = true;
      }
    } catch (err) {
      console.error("n8n-webhook: falha ao registrar consentimento LGPD:", err);
    }
  }

  // =========================================================================
  // 6) RETORNAR RESULTADO PARA O N8N
  // =========================================================================
  return {
    cliente_id: cliente.id,
    cliente_nome: cliente.full_name,
    cliente_criado: clienteCriado,
    cliente_drive_folder_id: cliente.drive_folder_id ?? null,

    caso_id: caso.id,
    caso_code: caso.case_code,
    caso_criado: casoCriado,
    caso_drive_folder_id: caso.drive_folder_id ?? null,

    documento_assinado_id: documentoAssinadoId,
    documento_assinado_criado: documentoAssinadoCriado,
    caso_promovido: casoPromovido,
    caso_lifecycle: casoLifecycle,
    consentimento_registrado: consentimentoRegistrado,
  };
}
