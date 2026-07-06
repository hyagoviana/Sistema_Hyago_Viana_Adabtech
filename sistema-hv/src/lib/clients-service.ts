// Server-only — orquestra CRUD de clientes (Supabase + Drive + audit).
// NUNCA importe este arquivo em código que roda no browser.

import slugify from "slugify";

import { createFolder, DriveError } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";
import type { Database, Json } from "./supabase/types";
import type { ClientCreateOutput, ClientUpdateOutput } from "./validators/client";

type ClientInsert = Database["public"]["Tables"]["system_clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["system_clients"]["Update"];

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export class ClientServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "DUPLICATE_CPF" | "NOT_FOUND" | "DB_ERROR",
    public readonly status: number,
  ) {
    super(message);
    this.name = "ClientServiceError";
  }
}

function clientsParentFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_DRIVE_CLIENTS_FOLDER_ID ausente. Defina no .env.local apontando pra pasta '01 - Clientes' do Shared Drive.",
    );
  }
  return id;
}

function buildFolderName(fullName: string, cpfCnpj: string): string {
  const slug = slugify(fullName, { lower: true, strict: true, locale: "pt" });
  return `${slug}-${cpfCnpj}`;
}

// ----------------------------------------------------------------------------
// CREATE
// ----------------------------------------------------------------------------
export async function createClient(input: ClientCreateOutput) {
  const sb = getSupabaseAdmin();

  // 1) INSERT cliente (cpf_cnpj já vem canônico do Zod transform)
  //    person_type é derivado do tamanho do CPF/CNPJ (11 = PF, 14 = PJ).
  const person_type = input.cpf_cnpj.length === 14 ? "PJ" : "PF";
  const { data: client, error } = await sb
    .from("system_clients")
    .insert({ ...input, organization_id: DEFAULT_ORG_ID, person_type } as ClientInsert)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ClientServiceError(
        "CPF/CNPJ já cadastrado para esta organização",
        "DUPLICATE_CPF",
        409,
      );
    }
    throw new ClientServiceError(error.message, "DB_ERROR", 500);
  }

  // 2) Criar pasta no Drive (best effort — não bloqueia)
  const folderName = buildFolderName(client.full_name, client.cpf_cnpj);
  type DriveFields = {
    drive_folder_id?: string | null;
    drive_folder_url?: string | null;
    drive_sync_failed: boolean;
    drive_sync_error: string | null;
  };
  let driveFields: DriveFields;
  try {
    const folder = await createFolder(folderName, clientsParentFolderId());
    driveFields = {
      drive_folder_id: folder.id,
      drive_folder_url: folder.url,
      drive_sync_failed: false,
      drive_sync_error: null,
    };
  } catch (err) {
    const msg =
      err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
    driveFields = {
      drive_sync_failed: true,
      drive_sync_error: msg.slice(0, 2000),
    };
  }

  const { data: updated, error: updateErr } = await sb
    .from("system_clients")
    .update(driveFields)
    .eq("id", client.id)
    .select()
    .single();

  const finalClient = updated ?? { ...client, ...driveFields };
  if (updateErr) {
    console.error("clients-service: falha ao salvar drive fields:", updateErr.message);
  }

  // 3) Audit log
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG_ID,
    action: "client.create",
    entity_type: "client",
    entity_id: client.id,
    diff: input as unknown as Json,
  });

  return finalClient;
}

// ----------------------------------------------------------------------------
// S1-04 — FIND-OR-CREATE por CPF na entrada comercial.
// ----------------------------------------------------------------------------
// Impede o erro "seco" de unicidade quando um CPF já cadastrado entra como lead
// de um NOVO caso. Padrão upsert sob concorrência (R-ARCH-4):
//   find → não achou → tenta INSERT → colidiu 23505 → re-SELECT → retorna existente.
// NUNCA estoura 500 por unique_violation. Merge apenas em campos VAZIOS (nunca
// sobrescreve valor existente); divergências viram `conflitos[]` para o front.
export type FindOrCreateResult = {
  client: Awaited<ReturnType<typeof createClient>>;
  created: boolean;
  conflitos: Array<{ campo: string; valor_atual: string; valor_novo: string }>;
};

type ClientRow = Database["public"]["Tables"]["system_clients"]["Row"];

// Campos escalares simples elegíveis a merge-em-vazio + detecção de conflito.
const MERGEABLE_SCALAR_FIELDS = ["full_name", "email", "phone", "rg", "tipo"] as const;

async function selectActiveByCpf(cpf: string): Promise<ClientRow | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_clients")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("cpf_cnpj", cpf)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as ClientRow | null) ?? null;
}

export async function findOrCreateClient(input: ClientCreateOutput): Promise<FindOrCreateResult> {
  const sb = getSupabaseAdmin();
  const cpf = input.cpf_cnpj;

  // 1) FIND — pessoa ativa com o mesmo CPF nesta org?
  const existing = await selectActiveByCpf(cpf);
  if (existing) {
    return await reconcileExisting(existing, input);
  }

  // 2) CREATE — não achou; tenta criar. Se colidir (23505 sob concorrência),
  //    re-SELECIONA o existente em vez de estourar 500.
  try {
    const client = await createClient(input);
    return { client, created: true, conflitos: [] };
  } catch (err) {
    if (err instanceof ClientServiceError && err.code === "DUPLICATE_CPF") {
      const raced = await selectActiveByCpf(cpf);
      if (raced) return await reconcileExisting(raced, input);
    }
    throw err;
  }
}

// Reconcilia um cadastro já existente com os novos dados: coleta conflitos
// (valor existente ≠ novo, ambos não-vazios) e faz merge só nos campos vazios.
async function reconcileExisting(
  existing: ClientRow,
  input: ClientCreateOutput,
): Promise<FindOrCreateResult> {
  const sb = getSupabaseAdmin();
  const conflitos: FindOrCreateResult["conflitos"] = [];
  const patch: Record<string, unknown> = {};

  const rec = existing as unknown as Record<string, unknown>;
  const inp = input as unknown as Record<string, unknown>;

  for (const campo of MERGEABLE_SCALAR_FIELDS) {
    const atual = rec[campo];
    const novo = inp[campo];
    const atualStr = typeof atual === "string" ? atual.trim() : "";
    const novoStr = typeof novo === "string" ? novo.trim() : "";
    if (!novoStr) continue;
    if (!atualStr) {
      // Campo vazio no cadastro → merge (preenche).
      patch[campo] = novoStr;
    } else if (atualStr !== novoStr) {
      // Ambos preenchidos e divergentes → NÃO sobrescreve; reporta conflito.
      conflitos.push({ campo, valor_atual: atualStr, valor_novo: novoStr });
    }
  }

  let client: ClientRow = existing;
  if (Object.keys(patch).length > 0) {
    const { data: updated } = await sb
      .from("system_clients")
      .update(patch as ClientUpdate)
      .eq("id", existing.id)
      .is("deleted_at", null)
      .select()
      .single();
    if (updated) client = updated as ClientRow;

    await sb.from("system_audit_log").insert({
      organization_id: existing.organization_id,
      action: "client.merge_empty_fields",
      entity_type: "client",
      entity_id: existing.id,
      diff: patch as unknown as Json,
    });
  }

  return {
    client: client as Awaited<ReturnType<typeof createClient>>,
    created: false,
    conflitos,
  };
}

// ----------------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------------
export async function updateClient(id: string, input: ClientUpdateOutput) {
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("system_clients")
    .update(input as ClientUpdate)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ClientServiceError(
        "CPF/CNPJ já cadastrado para esta organização",
        "DUPLICATE_CPF",
        409,
      );
    }
    if (error.code === "PGRST116") {
      throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);
    }
    throw new ClientServiceError(error.message, "DB_ERROR", 500);
  }
  if (!data) throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);

  await sb.from("system_audit_log").insert({
    organization_id: data.organization_id,
    action: "client.update",
    entity_type: "client",
    entity_id: data.id,
    diff: input as unknown as Json,
  });

  return data;
}

// ----------------------------------------------------------------------------
// SOFT-DELETE (com cascata em documentos)
// ----------------------------------------------------------------------------
export async function softDeleteClient(id: string) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("system_clients")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw new ClientServiceError(error.message, "DB_ERROR", 500);
  if (!data) throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);

  // Cascata em documentos
  await sb
    .from("system_client_documents")
    .update({ deleted_at: now })
    .eq("client_id", id)
    .is("deleted_at", null);

  await sb.from("system_audit_log").insert({
    organization_id: data.organization_id,
    action: "client.delete",
    entity_type: "client",
    entity_id: data.id,
  });

  return { ok: true as const, id };
}

// ----------------------------------------------------------------------------
// RE-SYNC DRIVE (chamado quando drive_sync_failed=true e usuário pede retry)
// ----------------------------------------------------------------------------
export async function resyncClientDriveFolder(id: string) {
  const sb = getSupabaseAdmin();

  const { data: client, error } = await sb
    .from("system_clients")
    .select("id, full_name, cpf_cnpj, organization_id, drive_folder_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error || !client) throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);

  if (client.drive_folder_id) {
    return { ok: true as const, alreadySynced: true, folderId: client.drive_folder_id };
  }

  const folderName = buildFolderName(client.full_name, client.cpf_cnpj);
  try {
    const folder = await createFolder(folderName, clientsParentFolderId());
    const { data: updated } = await sb
      .from("system_clients")
      .update({
        drive_folder_id: folder.id,
        drive_folder_url: folder.url,
        drive_sync_failed: false,
        drive_sync_error: null,
      })
      .eq("id", id)
      .select()
      .single();

    await sb.from("system_audit_log").insert({
      organization_id: client.organization_id,
      action: "client.drive_resync",
      entity_type: "client",
      entity_id: id,
      diff: { folder_id: folder.id },
    });

    return { ok: true as const, alreadySynced: false, folder: updated };
  } catch (err) {
    const msg =
      err instanceof DriveError ? `${err.message} (${err.safeCause ?? "?"})` : String(err);
    await sb
      .from("system_clients")
      .update({ drive_sync_failed: true, drive_sync_error: msg.slice(0, 2000) })
      .eq("id", id);
    throw new ClientServiceError(msg, "DB_ERROR", 502);
  }
}

// ----------------------------------------------------------------------------
// READ
// ----------------------------------------------------------------------------
export async function listClients(search?: string) {
  const sb = getSupabaseAdmin();
  const term = search?.trim();

  // Com termo de busca usamos a função SQL, que cobre nome, CPF, e-mail, dados
  // profissionais E os campos customizados (Melhoria 1).
  if (term) {
    const { data, error } = await sb.rpc("system_search_clients", { p_term: term });
    if (error) throw new ClientServiceError(error.message, "DB_ERROR", 500);
    return data ?? [];
  }

  const { data, error } = await sb.from("system_clients_active").select("*").order("full_name");
  if (error) throw new ClientServiceError(error.message, "DB_ERROR", 500);
  return data ?? [];
}

// ----------------------------------------------------------------------------
// S1-05 — LISTAGENS por lifecycle (abas Leads / Clientes / Perdidos).
// ----------------------------------------------------------------------------
// Cada aba lista PESSOAS DISTINTAS com >=1 caso naquele lifecycle (views da
// mig. 0031). Uma pessoa pode aparecer em mais de uma aba (LEAD num caso,
// CLIENTE em outro), mas nunca duplica linha dentro da mesma aba.
export type LifecycleTab = "lead" | "cliente" | "perdido";

export type ClientWithLifecycleMeta = ClientRow & {
  casos_no_lifecycle: number;
  dias_parado: number;
  ultimo_movimento: string | null;
};

// #15 — Fonte da aba "Leads": TODO cadastro que ainda não virou cliente. Um
// cadastro é cliente se tem ao menos um caso lifecycle='CLIENTE'. Cadastros puros
// (sem caso) e leads-only entram aqui. Usa o último movimento do caso LEAD mais
// recente (se houver) para dias_parado; sem caso, cai no created_at do cadastro.
async function listNonClientRegistrations(): Promise<ClientWithLifecycleMeta[]> {
  const sb = getSupabaseAdmin();

  // Pessoas que já são clientes (têm caso CLIENTE) — excluídas da aba Leads.
  const { data: clienteCases, error: ccErr } = await sb
    .from("system_cases_active")
    .select("client_id")
    .eq("lifecycle", "CLIENTE");
  if (ccErr) throw new ClientServiceError(ccErr.message, "DB_ERROR", 500);
  const clienteIds = new Set((clienteCases ?? []).map((c) => c.client_id));

  // Último movimento por pessoa a partir dos casos LEAD (para dias_parado).
  // OBS: lifecycle='LEAD' já EXCLUI PERDIDO (lifecycle distinto), então leadMeta só
  // tem leads ATIVOS.
  const { data: leadCases, error: lcErr } = await sb
    .from("system_cases_active")
    .select("client_id, status_changed_at, lifecycle")
    .eq("lifecycle", "LEAD");
  if (lcErr) throw new ClientServiceError(lcErr.message, "DB_ERROR", 500);
  const leadMeta = new Map<string, { count: number; ultimo: number }>();
  for (const c of leadCases ?? []) {
    const ts = c.status_changed_at ? new Date(c.status_changed_at).getTime() : 0;
    const prev = leadMeta.get(c.client_id);
    if (prev) {
      prev.count += 1;
      if (ts > prev.ultimo) prev.ultimo = ts;
    } else {
      leadMeta.set(c.client_id, { count: 1, ultimo: ts });
    }
  }

  // ITEM 6.4 — pessoas com caso PERDIDO. Um lead PERDIDO (só com caso PERDIDO, sem
  // lead ATIVO) NÃO deve reaparecer como "cadastro sintético novo" na aba Leads —
  // o padrão é NÃO mostrar perdido em Leads (ele vive na aba Perdido). Excluímos
  // da aba Leads quem tem PERDIDO e NÃO tem lead ativo.
  const { data: perdidoCases, error: pcErr } = await sb
    .from("system_cases_active")
    .select("client_id")
    .eq("lifecycle", "PERDIDO");
  if (pcErr) throw new ClientServiceError(pcErr.message, "DB_ERROR", 500);
  const perdidoIds = new Set((perdidoCases ?? []).map((c) => c.client_id));

  // Todos os cadastros ativos que NÃO são clientes.
  const { data: clients, error: cErr } = await sb
    .from("system_clients")
    .select("*")
    .is("deleted_at", null);
  if (cErr) throw new ClientServiceError(cErr.message, "DB_ERROR", 500);

  const now = Date.now();
  const out: ClientWithLifecycleMeta[] = (clients ?? [])
    // Fora: clientes (CLIENTE) e leads PERDIDOS sem nenhum lead ativo.
    .filter((cli) => !clienteIds.has(cli.id) && !(perdidoIds.has(cli.id) && !leadMeta.has(cli.id)))
    .map((cli) => {
      const meta = leadMeta.get(cli.id);
      const base = meta?.ultimo || new Date(cli.created_at).getTime();
      const dias = base ? Math.max(0, Math.floor((now - base) / 86_400_000)) : 0;
      return {
        ...(cli as ClientRow),
        casos_no_lifecycle: meta?.count ?? 0,
        dias_parado: dias,
        ultimo_movimento: base ? new Date(base).toISOString() : null,
      };
    });
  // Mais parados primeiro.
  out.sort((a, b) => b.dias_parado - a.dias_parado);
  return out;
}

// Deriva a aba pela base tipada (system_cases_active expõe lifecycle/perdido_at
// após S1-01). Agrupa por pessoa (distinct) e calcula dias_parado sem persistir
// valor stale. Evita depender das views não tipadas (mig. 0031) no client tipado.
export async function listClientsByLifecycle(
  tab: LifecycleTab,
): Promise<ClientWithLifecycleMeta[]> {
  const sb = getSupabaseAdmin();

  // #15 — aba LEADS = TODO cadastro que ainda NÃO é cliente (inclui cadastros
  // puros, sem nenhum caso). Antes exigia caso LEAD, o que escondia cadastros
  // recém-criados. "Cliente" = quem já tem algum caso CLIENTE.
  if (tab === "lead") {
    return listNonClientRegistrations();
  }

  const lifecycle = tab === "cliente" ? "CLIENTE" : "PERDIDO";

  const { data: cases, error } = await sb
    .from("system_cases_active")
    .select("client_id, status_changed_at, perdido_at, lifecycle")
    .eq("lifecycle", lifecycle);
  if (error) throw new ClientServiceError(error.message, "DB_ERROR", 500);

  const rows = cases ?? [];

  // Agrupa por pessoa: conta casos + último movimento (max de status/ perdido).
  const byClient = new Map<string, { count: number; ultimo: number }>();
  for (const c of rows) {
    const ref = tab === "perdido" ? c.perdido_at : c.status_changed_at;
    const ts = ref ? new Date(ref).getTime() : 0;
    const prev = byClient.get(c.client_id);
    if (prev) {
      prev.count += 1;
      if (ts > prev.ultimo) prev.ultimo = ts;
    } else {
      byClient.set(c.client_id, { count: 1, ultimo: ts });
    }
  }
  if (byClient.size === 0) return [];

  const { data: clients, error: cErr } = await sb
    .from("system_clients")
    .select("*")
    .in("id", Array.from(byClient.keys()))
    .is("deleted_at", null);
  if (cErr) throw new ClientServiceError(cErr.message, "DB_ERROR", 500);

  const now = Date.now();
  const out: ClientWithLifecycleMeta[] = (clients ?? []).map((cli) => {
    const meta = byClient.get(cli.id)!;
    const dias = meta.ultimo ? Math.max(0, Math.floor((now - meta.ultimo) / 86_400_000)) : 0;
    return {
      ...(cli as ClientRow),
      casos_no_lifecycle: meta.count,
      dias_parado: dias,
      ultimo_movimento: meta.ultimo ? new Date(meta.ultimo).toISOString() : null,
    };
  });
  // Mais parados primeiro.
  out.sort((a, b) => b.dias_parado - a.dias_parado);
  return out;
}

export async function getClient(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("system_clients").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") {
      throw new ClientServiceError("Cliente não encontrado", "NOT_FOUND", 404);
    }
    throw new ClientServiceError(error.message, "DB_ERROR", 500);
  }
  return data;
}
