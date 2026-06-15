// Server-only — orquestra o fluxo de integração n8n → Supabase + Drive.
// NUNCA importe em código que roda no browser.
//
// Fluxo:
//   1. n8n recebe e-mail do Zaping (WhatsApp)
//   2. Chama este webhook com dados do cliente + processo
//   3. Busca cliente por CPF/CNPJ → se não existe, cria + pasta no Drive
//   4. Busca caso pelo tipo + cliente → se não existe, cria
//   5. Cria subpasta do caso dentro da pasta do cliente no Drive
//   6. Retorna IDs para o n8n continuar o fluxo

import slugify from "slugify";

import { createFolder, DriveError } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";
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
  tipo_processo: string;     // ex: "FIES_ESF", "COVID", etc.
  numero_processo?: string | null;
  municipio?: string | null;
  responsavel?: string | null;
  proximo_passo?: string | null;

  // Documento (opcional — se veio arquivo junto)
  documento_nome?: string | null;
  documento_url?: string | null;
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
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function clientsParentFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID;
  if (!id) {
    throw new N8nWebhookError(
      "GOOGLE_DRIVE_CLIENTS_FOLDER_ID ausente no .env",
      500,
    );
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

// ----------------------------------------------------------------------------
// MAIN: processar payload do n8n
// ----------------------------------------------------------------------------
export async function processN8nWebhook(
  payload: N8nIncomingPayload,
): Promise<N8nWebhookResult> {
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
          throw new N8nWebhookError(
            `Falha ao criar/buscar cliente: ${insertErr.message}`,
            500,
          );
        }
        cliente = retry;
      } else {
        throw new N8nWebhookError(
          `Erro ao criar cliente: ${insertErr.message}`,
          500,
        );
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
        err instanceof DriveError
          ? `${err.message} (${err.safeCause ?? "?"})`
          : String(err);
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

    const { data: newCase, error: caseErr } = await sb
      .from("system_cases")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        client_id: cliente.id,
        case_code: caseCode,
        case_type: payload.tipo_processo,
        macrostatus_op: "ONBOARDING",
        macrostatus_fin: "NAO_APLICAVEL",
        proximo_passo: payload.proximo_passo?.trim() || null,
        responsavel: payload.responsavel?.trim() || null,
        municipio: payload.municipio?.trim() || null,
      })
      .select()
      .single();

    if (caseErr || !newCase) {
      throw new N8nWebhookError(
        `Erro ao criar caso: ${caseErr?.message ?? "unknown"}`,
        500,
      );
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
        err instanceof DriveError
          ? `${err.message} (${err.safeCause ?? "?"})`
          : String(err);
      console.error("n8n-webhook: falha ao criar subpasta do caso no Drive:", msg);
    }
  }

  // =========================================================================
  // 5) RETORNAR RESULTADO PARA O N8N
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
  };
}
