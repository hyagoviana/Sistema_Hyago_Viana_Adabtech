// Server-only — processa webhooks do Asaas.
// Atualiza o status das parcelas em system_parcelas quando o Asaas
// notifica sobre mudanças de status de pagamento.

import { getSupabaseAdmin } from "../supabase/server";
import type { Json } from "../supabase/types";
import type { AsaasWebhookPayload } from "./types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

// Mapeamento de status do Asaas → status da parcela no sistema.
const STATUS_MAP: Record<string, string> = {
  RECEIVED: "PAGA",
  CONFIRMED: "PAGA",
  RECEIVED_IN_CASH: "PAGA",
  OVERDUE: "VENCIDA",
  REFUNDED: "CANCELADA",
  DELETED: "CANCELADA",
  PENDING: "PENDENTE",
};

export async function processAsaasWebhook(
  payload: AsaasWebhookPayload,
): Promise<{ ok: true; action: string }> {
  const sb = getSupabaseAdmin();
  const { event, payment } = payload;

  if (!payment?.id) {
    return { ok: true, action: "ignored_no_payment" };
  }

  // Busca a(s) parcela(s) vinculada(s) a este pagamento do Asaas
  const { data: parcelas } = await sb
    .from("system_parcelas")
    .select("id, status, case_id")
    .eq("provider", "asaas")
    .eq("provider_ext_id", payment.id);

  if (!parcelas || parcelas.length === 0) {
    return { ok: true, action: "ignored_no_parcela" };
  }

  const newStatus = STATUS_MAP[payment.status];
  if (!newStatus) {
    return { ok: true, action: `ignored_status_${payment.status}` };
  }

  for (const parcela of parcelas) {
    if (parcela.status === newStatus) continue;

    const updateData: Record<string, unknown> = { status: newStatus };

    // Se foi pago, registra data e valor do pagamento
    if (newStatus === "PAGA") {
      updateData.data_pagamento = payment.paymentDate ?? new Date().toISOString();
      updateData.valor_pago_centavos = Math.round(payment.value * 100);
      updateData.metodo_pagamento = payment.billingType;
      updateData.boleto_url = payment.bankSlipUrl ?? payment.invoiceUrl ?? null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("system_parcelas") as any)
      .update(updateData)
      .eq("id", parcela.id);

    // Audit
    await sb.from("system_audit_log").insert({
      organization_id: DEFAULT_ORG,
      action: `asaas.webhook.${event.toLowerCase()}`,
      entity_type: "parcela",
      entity_id: parcela.id,
      diff: {
        asaas_payment_id: payment.id,
        old_status: parcela.status,
        new_status: newStatus,
        asaas_status: payment.status,
      } as unknown as Json,
    });
  }

  return { ok: true, action: `updated_${parcelas.length}_parcelas` };
}
