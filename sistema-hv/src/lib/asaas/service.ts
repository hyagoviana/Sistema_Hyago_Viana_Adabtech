// Server-only — orquestra integração Asaas ↔ Sistema HV.
// Sincroniza clientes e gera cobranças vinculando com system_parcelas.

import { getSupabaseAdmin } from "../supabase/server";
import type { Json } from "../supabase/types";
import {
  createCustomer,
  createPayment,
  deletePayment,
  findCustomerByCpfCnpj,
  getPayment,
  getPixQrCode,
  listPaymentsByCustomer,
  updateCustomer,
  AsaasError,
} from "./client";
import type {
  AsaasBillingType,
  AsaasCustomer,
  AsaasDiscount,
  AsaasFine,
  AsaasInterest,
  AsaasPayment,
  AsaasPixQrCode,
} from "./types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class AsaasServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AsaasServiceError";
  }
}

// ─── Sync Cliente → Asaas ────────────────────────────────────────────────────

/**
 * Sincroniza um cliente do sistema com o Asaas.
 * - Se já tem asaas_customer_id, atualiza os dados no Asaas.
 * - Se não tem, busca por CPF/CNPJ no Asaas; se achar, vincula; senão, cria.
 * Retorna o ID do cliente no Asaas e salva em system_clients.asaas_customer_id.
 */
export async function syncClientToAsaas(clientId: string): Promise<{
  asaasCustomerId: string;
  created: boolean;
}> {
  const sb = getSupabaseAdmin();

  const { data: client, error } = await sb
    .from("system_clients")
    .select("*")
    .eq("id", clientId)
    .is("deleted_at", null)
    .single();

  if (error || !client) {
    throw new AsaasServiceError("Cliente não encontrado.", 404);
  }

  const address = client.address as Record<string, string> | null;

  const asaasData = {
    name: client.full_name,
    cpfCnpj: client.cpf_cnpj,
    email: client.email ?? undefined,
    mobilePhone: client.phone ?? undefined,
    address: address?.street ?? undefined,
    addressNumber: address?.number ?? undefined,
    complement: address?.complement ?? undefined,
    province: address?.neighborhood ?? undefined,
    postalCode: address?.zipcode ?? undefined,
    externalReference: client.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let asaasCustomerId = (client as any).asaas_customer_id as string | null;
  let created = false;

  if (asaasCustomerId) {
    // Já vinculado — atualiza dados no Asaas
    try {
      await updateCustomer(asaasCustomerId, asaasData);
    } catch (err) {
      if (err instanceof AsaasError) {
        throw new AsaasServiceError(`Erro ao atualizar cliente no Asaas: ${err.message}`, err.status ?? 500);
      }
      throw err;
    }
  } else {
    // Tenta encontrar por CPF no Asaas
    let existing: AsaasCustomer | null = null;
    try {
      existing = await findCustomerByCpfCnpj(client.cpf_cnpj);
    } catch {
      // Ignora erro de busca e tenta criar
    }

    if (existing) {
      asaasCustomerId = existing.id;
    } else {
      try {
        const newCustomer = await createCustomer(asaasData);
        asaasCustomerId = newCustomer.id;
        created = true;
      } catch (err) {
        if (err instanceof AsaasError) {
          throw new AsaasServiceError(`Erro ao criar cliente no Asaas: ${err.message}`, err.status ?? 500);
        }
        throw err;
      }
    }

    // Salva o ID do Asaas no cadastro local
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("system_clients") as any)
      .update({ asaas_customer_id: asaasCustomerId })
      .eq("id", clientId);

    // Audit
    await sb.from("system_audit_log").insert({
      organization_id: DEFAULT_ORG,
      action: created ? "asaas.customer_created" : "asaas.customer_linked",
      entity_type: "client",
      entity_id: clientId,
      diff: { asaas_customer_id: asaasCustomerId } as unknown as Json,
    });
  }

  return { asaasCustomerId: asaasCustomerId!, created };
}

// ─── Gerar Cobrança ──────────────────────────────────────────────────────────

export type CreateChargeInput = {
  caseId: string;
  billingType: AsaasBillingType;
  value: number; // em REAIS (ex: 150.00)
  dueDate: string; // YYYY-MM-DD
  description?: string;
  installmentCount?: number; // se > 1, gera parcelamento
  discount?: AsaasDiscount;
  interest?: AsaasInterest;
  fine?: AsaasFine;
};

/**
 * Gera cobrança no Asaas vinculada a um caso.
 * 1) Busca o caso e o cliente
 * 2) Garante que o cliente está sincronizado no Asaas
 * 3) Cria a cobrança no Asaas
 * 4) Cria as parcelas em system_parcelas vinculadas
 */
export async function createCharge(input: CreateChargeInput): Promise<{
  payment: AsaasPayment;
  parcelaIds: string[];
}> {
  const sb = getSupabaseAdmin();

  // 1) Buscar caso → cliente
  const { data: caso, error: caseErr } = await sb
    .from("system_cases")
    .select("id, client_id, case_code")
    .eq("id", input.caseId)
    .single();

  if (caseErr || !caso) {
    throw new AsaasServiceError("Caso não encontrado.", 404);
  }

  // 2) Garantir sync com Asaas
  const { asaasCustomerId } = await syncClientToAsaas(caso.client_id);

  // 3) Criar cobrança no Asaas
  const paymentData = {
    customer: asaasCustomerId,
    billingType: input.billingType,
    value: input.value,
    dueDate: input.dueDate,
    description: input.description ?? `Caso ${caso.case_code ?? caso.id}`,
    externalReference: caso.id,
    ...(input.installmentCount && input.installmentCount > 1
      ? {
          installmentCount: input.installmentCount,
          installmentValue: input.value,
        }
      : {}),
    ...(input.discount ? { discount: input.discount } : {}),
    ...(input.interest ? { interest: input.interest } : {}),
    ...(input.fine ? { fine: input.fine } : {}),
  };

  let payment: AsaasPayment;
  try {
    payment = await createPayment(paymentData);
  } catch (err) {
    if (err instanceof AsaasError) {
      throw new AsaasServiceError(`Erro ao criar cobrança no Asaas: ${err.message}`, err.status ?? 500);
    }
    throw err;
  }

  // 4) Buscar o termo ativo do caso (para FK em system_parcelas)
  const { data: termo } = await sb
    .from("system_termo_snapshots")
    .select("id")
    .eq("case_id", input.caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const termoId = termo?.id ?? null;

  // 5) Criar parcela(s) em system_parcelas
  const totalParcelas = input.installmentCount && input.installmentCount > 1 ? input.installmentCount : 1;
  const valorCentavos = Math.round(input.value * 100);
  const parcelaIds: string[] = [];

  for (let i = 0; i < totalParcelas; i++) {
    const vencimento = addMonths(input.dueDate, i);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parcela, error: pErr } = await (sb.from("system_parcelas") as any)
      .insert({
        organization_id: DEFAULT_ORG,
        case_id: input.caseId,
        termo_id: termoId,
        numero: i + 1,
        valor_centavos: valorCentavos,
        vencimento,
        status: "PENDENTE",
        provider: "asaas",
        provider_ext_id: payment.id,
        boleto_url: payment.bankSlipUrl ?? payment.invoiceUrl ?? null,
      })
      .select("id")
      .single();

    if (pErr) {
      console.error("asaas-service: erro ao inserir parcela:", pErr.message);
      continue;
    }
    if (parcela) parcelaIds.push(parcela.id);
  }

  // Audit
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "asaas.charge_created",
    entity_type: "case",
    entity_id: input.caseId,
    diff: {
      asaas_payment_id: payment.id,
      billing_type: input.billingType,
      value: input.value,
      installments: totalParcelas,
    } as unknown as Json,
  });

  return { payment, parcelaIds };
}

// ─── Consultar Cobrança ──────────────────────────────────────────────────────

/** Busca status atualizado de uma cobrança no Asaas pelo provider_ext_id da parcela. */
export async function getChargeStatus(parcelaId: string): Promise<AsaasPayment> {
  const sb = getSupabaseAdmin();

  const { data: parcela, error } = await sb
    .from("system_parcelas")
    .select("provider_ext_id, provider")
    .eq("id", parcelaId)
    .single();

  if (error || !parcela) {
    throw new AsaasServiceError("Parcela não encontrada.", 404);
  }
  if (parcela.provider !== "asaas" || !parcela.provider_ext_id) {
    throw new AsaasServiceError("Parcela não vinculada ao Asaas.", 400);
  }

  return getPayment(parcela.provider_ext_id);
}

/** Gera QR Code Pix para uma parcela vinculada ao Asaas. */
export async function getParcelaPixQrCode(parcelaId: string): Promise<AsaasPixQrCode> {
  const sb = getSupabaseAdmin();

  const { data: parcela, error } = await sb
    .from("system_parcelas")
    .select("provider_ext_id, provider")
    .eq("id", parcelaId)
    .single();

  if (error || !parcela) {
    throw new AsaasServiceError("Parcela não encontrada.", 404);
  }
  if (parcela.provider !== "asaas" || !parcela.provider_ext_id) {
    throw new AsaasServiceError("Parcela não vinculada ao Asaas.", 400);
  }

  return getPixQrCode(parcela.provider_ext_id);
}

/** Cancela uma cobrança no Asaas e atualiza a parcela local. */
export async function cancelCharge(parcelaId: string): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();

  const { data: parcela, error } = await sb
    .from("system_parcelas")
    .select("id, provider_ext_id, provider, case_id")
    .eq("id", parcelaId)
    .single();

  if (error || !parcela) {
    throw new AsaasServiceError("Parcela não encontrada.", 404);
  }
  if (parcela.provider !== "asaas" || !parcela.provider_ext_id) {
    throw new AsaasServiceError("Parcela não vinculada ao Asaas.", 400);
  }

  await deletePayment(parcela.provider_ext_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("system_parcelas") as any)
    .update({ status: "CANCELADA" })
    .eq("id", parcelaId);

  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "asaas.charge_cancelled",
    entity_type: "parcela",
    entity_id: parcelaId,
    diff: { asaas_payment_id: parcela.provider_ext_id } as unknown as Json,
  });

  return { ok: true };
}

/** Lista cobranças no Asaas para um cliente do sistema. */
export async function listClientCharges(clientId: string) {
  const sb = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (sb.from("system_clients") as any)
    .select("asaas_customer_id")
    .eq("id", clientId)
    .single();

  const asaasId = client?.asaas_customer_id as string | null;
  if (!asaasId) {
    throw new AsaasServiceError("Cliente não sincronizado com Asaas.", 400);
  }

  return listPaymentsByCustomer(asaasId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Adiciona N meses a uma data YYYY-MM-DD. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
