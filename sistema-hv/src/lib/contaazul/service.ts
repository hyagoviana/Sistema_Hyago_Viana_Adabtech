// Server-only — orquestra integração Conta Azul v2 ↔ Sistema HV.
// Sincroniza clientes (pessoas) e gera cobranças.

import { getSupabaseAdmin } from "../supabase/server";
import type { Json } from "../supabase/types";
import {
  ContaAzulError,
  createPessoa,
  findPessoaByDocumento,
  getAccessToken,
  updatePessoa,
  type CAPessoa,
} from "./client";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class ContaAzulServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ContaAzulServiceError";
  }
}

// ─── Sync Cliente → Conta Azul ───────────────────────────────────────────────

export async function syncClientToContaAzul(clientId: string): Promise<{
  contaAzulCustomerId: string;
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
    throw new ContaAzulServiceError("Cliente não encontrado.", 404);
  }

  const address = client.address as Record<string, string> | null;
  const tipoPessoa = client.cpf_cnpj.length === 14 ? "Jurídica" : "Física";

  const enderecoObj = address
    ? {
        endereco: {
          cep: address.zipcode,
          logradouro: address.street,
          numero: address.number,
          complemento: address.complement,
          bairro: address.neighborhood,
          cidade: address.city,
          uf: address.state,
        },
      }
    : {};

  // CRIAÇÃO (POST): inclui perfis + tipo_pessoa + documento (obrigatórios).
  const caData = {
    nome: client.full_name,
    tipo_pessoa: tipoPessoa as "Física" | "Jurídica",
    documento: client.cpf_cnpj,
    email: client.email ?? undefined,
    telefone: client.phone ?? undefined,
    perfis: ["Cliente"],
    ...enderecoObj,
  };

  // ATUALIZAÇÃO (PUT): o Conta Azul REJEITA (400) campos não-editáveis como
  // `perfis` (e documento/tipo_pessoa são imutáveis). Envia só o que muda.
  const caUpdate = {
    nome: client.full_name,
    email: client.email ?? undefined,
    telefone: client.phone ?? undefined,
    ...enderecoObj,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let caCustomerId = (client as any).contaazul_customer_id as string | null;
  let created = false;

  if (caCustomerId) {
    try {
      await updatePessoa(caCustomerId, caUpdate);
    } catch (err) {
      if (err instanceof ContaAzulError) {
        throw new ContaAzulServiceError(
          `Erro ao atualizar pessoa no Conta Azul: ${err.message}`,
          err.status ?? 500,
        );
      }
      throw err;
    }
  } else {
    let existing: CAPessoa | null = null;
    try {
      existing = await findPessoaByDocumento(client.cpf_cnpj);
    } catch {
      // Ignora e tenta criar
    }

    if (existing) {
      caCustomerId = existing.id;
    } else {
      try {
        const newPessoa = await createPessoa(caData);
        caCustomerId = newPessoa.id;
        created = true;
      } catch (err) {
        if (err instanceof ContaAzulError) {
          throw new ContaAzulServiceError(
            `Erro ao criar pessoa no Conta Azul: ${err.message}`,
            err.status ?? 500,
          );
        }
        throw err;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("system_clients") as any)
      .update({ contaazul_customer_id: caCustomerId })
      .eq("id", clientId);

    await sb.from("system_audit_log").insert({
      organization_id: DEFAULT_ORG,
      action: created ? "contaazul.pessoa_created" : "contaazul.pessoa_linked",
      entity_type: "client",
      entity_id: clientId,
      diff: { contaazul_customer_id: caCustomerId } as unknown as Json,
    });
  }

  return { contaAzulCustomerId: caCustomerId!, created };
}

// ─── Gerar Cobrança (via API de Vendas quando disponível) ────────────────────

export type CreateContaAzulChargeInput = {
  caseId: string;
  paymentMethod: string;
  value: number; // em REAIS
  dueDate: string; // YYYY-MM-DD
  description?: string;
  installmentCount?: number;
};

/**
 * Gera cobrança no Conta Azul vinculada a um caso.
 * Por enquanto cria as parcelas localmente e sincroniza o cliente.
 * A integração completa de vendas será feita quando a API v2 de vendas
 * estiver documentada/disponível.
 */
export async function createContaAzulCharge(input: CreateContaAzulChargeInput): Promise<{
  parcelaIds: string[];
}> {
  const sb = getSupabaseAdmin();

  // 1) Buscar caso
  const { data: caso, error: caseErr } = await sb
    .from("system_cases")
    .select("id, client_id, case_code")
    .eq("id", input.caseId)
    .single();

  if (caseErr || !caso) {
    throw new ContaAzulServiceError("Caso não encontrado.", 404);
  }

  // 2) Sync com Conta Azul
  await syncClientToContaAzul(caso.client_id);

  // 3) Buscar termo ativo do caso
  const { data: termo } = await sb
    .from("system_termo_snapshots")
    .select("id")
    .eq("case_id", input.caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const termoId = termo?.id ?? null;

  // 4) Criar parcelas em system_parcelas
  const qtdParcelas = input.installmentCount && input.installmentCount > 1 ? input.installmentCount : 1;
  const valorCentavos = Math.round(input.value * 100);
  const valorParcelaCentavos = qtdParcelas > 1 ? Math.round(valorCentavos / qtdParcelas) : valorCentavos;
  const parcelaIds: string[] = [];

  for (let i = 0; i < qtdParcelas; i++) {
    const vencimento = addMonths(input.dueDate, i);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parcela, error: pErr } = await (sb.from("system_parcelas") as any)
      .insert({
        organization_id: DEFAULT_ORG,
        case_id: input.caseId,
        termo_id: termoId,
        numero: i + 1,
        valor_centavos: valorParcelaCentavos,
        vencimento,
        status: "PENDENTE",
        provider: "conta_azul",
      })
      .select("id")
      .single();

    if (pErr) {
      console.error("contaazul-service: erro ao inserir parcela:", pErr.message);
      continue;
    }
    if (parcela) parcelaIds.push(parcela.id);
  }

  // Audit
  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "contaazul.charge_created",
    entity_type: "case",
    entity_id: input.caseId,
    diff: {
      payment_method: input.paymentMethod,
      value: input.value,
      installments: qtdParcelas,
    } as unknown as Json,
  });

  return { parcelaIds };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
