// Server-only — orquestra integração Conta Azul v2 ↔ Sistema HV.
// Sincroniza clientes (pessoas) e gera cobranças.

import { getSupabaseAdmin } from "../supabase/server";
import type { Json } from "../supabase/types";
import {
  buscarContasAReceber,
  ContaAzulError,
  createPessoa,
  criarContaAReceber,
  findPessoaByDocumento,
  getAccessToken,
  getPessoa,
  listContasFinanceiras,
  updatePessoa,
  type CAContaAReceberItem,
  type CAContaReceberParcela,
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

  const cpfOrCnpj =
    tipoPessoa === "Física"
      ? { cpf: client.cpf_cnpj }
      : { cnpj: client.cpf_cnpj };

  // CRIAÇÃO (POST): inclui perfis + tipo_pessoa + cpf/cnpj + codigo (obrigatórios).
  const caData = {
    codigo: client.cpf_cnpj,
    nome: client.full_name,
    tipo_pessoa: tipoPessoa as "Física" | "Jurídica",
    ...cpfOrCnpj,
    email: client.email ?? undefined,
    telefone: client.phone ?? undefined,
    perfis: ["Cliente"],
    ...enderecoObj,
  };

  // ATUALIZAÇÃO (PUT): mesmo payload, sem `perfis` (rejeitado pela API).
  const caUpdate = {
    nome: client.full_name,
    tipo_pessoa: tipoPessoa as "Física" | "Jurídica",
    ...cpfOrCnpj,
    email: client.email ?? undefined,
    telefone: client.phone ?? undefined,
    ...enderecoObj,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let caCustomerId = (client as any).contaazul_customer_id as string | null;
  let created = false;

  if (caCustomerId) {
    try {
      // GET primeiro: a API exige TODOS os campos obrigatórios no PUT.
      // Merge o registro existente com as atualizações para não perder nenhum campo.
      const existingPessoa = await getPessoa(caCustomerId);
      const updatePayload = { ...existingPessoa, ...caUpdate, codigo: existingPessoa.codigo || client.cpf_cnpj };
      // Remove campos que o PUT rejeita ou que são read-only
      delete (updatePayload as Record<string, unknown>).id;
      delete (updatePayload as Record<string, unknown>).ativo;
      delete (updatePayload as Record<string, unknown>).data_criacao;
      delete (updatePayload as Record<string, unknown>).data_alteracao;
      console.log("contaazul: atualizando pessoa", caCustomerId, "payload:", JSON.stringify(updatePayload));
      await updatePessoa(caCustomerId, updatePayload);
      console.log("contaazul: pessoa atualizada com sucesso");
    } catch (err) {
      console.error("contaazul: ERRO ao atualizar pessoa:", err instanceof ContaAzulError ? { status: err.status, body: err.safeBody, msg: err.message } : err);
      if (err instanceof ContaAzulError) {
        throw new ContaAzulServiceError(
          `Erro ao atualizar pessoa no Conta Azul: ${err.message}${err.safeBody ? ` | ${err.safeBody}` : ""}`,
          err.status ?? 500,
        );
      }
      throw err;
    }
  } else {
    let existing: CAPessoa | null = null;
    try {
      console.log("contaazul: buscando pessoa por documento:", client.cpf_cnpj);
      existing = await findPessoaByDocumento(client.cpf_cnpj);
      console.log("contaazul: pessoa encontrada?", existing ? existing.id : "não");
    } catch (findErr) {
      console.warn("contaazul: erro ao buscar pessoa por documento:", findErr instanceof Error ? findErr.message : findErr);
      // Ignora e tenta criar
    }

    if (existing) {
      caCustomerId = existing.id;
    } else {
      try {
        console.log("contaazul: criando pessoa com payload:", JSON.stringify(caData));
        const newPessoa = await createPessoa(caData);
        caCustomerId = newPessoa.id;
        created = true;
      } catch (err) {
        if (err instanceof ContaAzulError) {
          console.error("contaazul: erro ao criar pessoa:", err.status, err.safeBody, err.message);
          throw new ContaAzulServiceError(
            `Erro ao criar pessoa no Conta Azul: ${err.message}${err.safeBody ? ` | ${err.safeBody}` : ""}`,
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
 * Gera COBRANÇA no Conta Azul (evento financeiro de contas a receber) vinculada a
 * um caso: cria a pessoa (contato), cria a conta a receber com as parcelas — o
 * Conta Azul emite boleto/pix + e-mail ao cliente pela conta financeira (Receba
 * Fácil) — e espelha as parcelas em system_parcelas (fonte do relatório). O id da
 * parcela no Conta Azul (para a baixa) é reconciliado depois pelo sync.
 */
export async function createContaAzulCharge(input: CreateContaAzulChargeInput): Promise<{
  parcelaIds: string[];
  protocolo: string | null;
}> {
  const sb = getSupabaseAdmin();

  // 1) Caso + cliente
  const { data: caso, error: caseErr } = await sb
    .from("system_cases")
    .select("id, client_id, case_code")
    .eq("id", input.caseId)
    .single();
  if (caseErr || !caso) throw new ContaAzulServiceError("Caso não encontrado.", 404);

  // 2) Sincroniza a pessoa no Conta Azul (contato da cobrança).
  const { contaAzulCustomerId } = await syncClientToContaAzul(caso.client_id);

  // 3) Conta financeira que EMITE cobrança (Receba Fácil / Conta PJ Conta Azul).
  //    Sem ela, o Conta Azul não gera boleto/pix/link/e-mail.
  const contas = await listContasFinanceiras().catch(() => ({
    itens: [] as { id: string }[],
  }));
  const contaFinanceiraId = contas.itens?.[0]?.id ?? null;
  if (!contaFinanceiraId) {
    throw new ContaAzulServiceError(
      "Nenhuma conta financeira no Conta Azul. Ative o Receba Fácil (ou Conta PJ) para emitir cobrança.",
      422,
    );
  }

  // 4) Termo (FK) + montagem das parcelas
  const { data: termo } = await sb
    .from("system_termo_snapshots")
    .select("id")
    .eq("case_id", input.caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const termoId = termo?.id ?? null;

  const qtdParcelas =
    input.installmentCount && input.installmentCount > 1 ? input.installmentCount : 1;
  const valorCentavos = Math.round(input.value * 100);
  const valorParcelaCentavos =
    qtdParcelas > 1 ? Math.round(valorCentavos / qtdParcelas) : valorCentavos;
  const descricaoBase = input.description?.trim() || `Honorários advocatícios — ${caso.case_code}`;

  const parcelasPayload: CAContaReceberParcela[] = [];
  const vencimentos: string[] = [];
  for (let i = 0; i < qtdParcelas; i++) {
    const vencimento = addMonths(input.dueDate, i);
    vencimentos.push(vencimento);
    parcelasPayload.push({
      descricao: qtdParcelas > 1 ? `${descricaoBase} (${i + 1}/${qtdParcelas})` : descricaoBase,
      data_vencimento: vencimento,
      nota: caso.case_code,
      conta_financeira: contaFinanceiraId,
      detalhe_valor: { valor_bruto: valorParcelaCentavos / 100 },
      metodo_pagamento: mapPaymentMethod(input.paymentMethod),
    });
  }

  // 5) Cria a cobrança (conta a receber) no Conta Azul. Se falhar, NÃO cria as
  //    parcelas locais (evita divergência). Resposta é assíncrona (protocolo).
  const receber = await criarContaAReceber({
    data_competencia: input.dueDate,
    valor: valorCentavos / 100,
    observacao: descricaoBase,
    descricao: descricaoBase,
    contato: contaAzulCustomerId,
    conta_financeira: contaFinanceiraId,
    condicao_pagamento: { parcelas: parcelasPayload },
  });

  // 6) Espelha as parcelas no banco (o relatório lê de system_parcelas).
  const parcelaIds: string[] = [];
  for (let i = 0; i < qtdParcelas; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parcela, error: pErr } = await (sb.from("system_parcelas") as any)
      .insert({
        organization_id: DEFAULT_ORG,
        case_id: input.caseId,
        termo_id: termoId,
        numero: i + 1,
        valor_centavos: valorParcelaCentavos,
        vencimento: vencimentos[i],
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

  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "contaazul.charge_created",
    entity_type: "case",
    entity_id: input.caseId,
    diff: {
      protocolo: receber.protocolo,
      payment_method: input.paymentMethod,
      value: input.value,
      installments: qtdParcelas,
    } as unknown as Json,
  });

  return { parcelaIds, protocolo: receber.protocolo ?? null };
}

// ─── Sync de PAGAMENTOS (cron diário 08:30 + botão manual) ───────────────────

/**
 * Varre as parcelas com cobrança no Conta Azul (provider='conta_azul') que ainda
 * estão PENDENTE, consulta no Conta Azul quais já foram RECEBIDAS (endpoint de
 * busca de contas a receber) e espelha a baixa em `system_parcelas` (status PAGA
 * + data/valor pago) — o relatório financeiro lê de system_parcelas, então
 * reflete automaticamente.
 *
 * Chamada pelo cron (api/cron/sync-contaazul, 08:30 BRT) e reusável pelo botão
 * "Sync Conta Azul" do caso (passando um caseId).
 *
 * Matching parcela local ↔ item do Conta Azul: (a) por `provider_ext_id` (id da
 * parcela CA) quando já reconciliado; senão (b) heurística por `case_code` (que
 * gravamos no campo `nota`/`descricao` da cobrança) + valor + vencimento — e nesse
 * caso grava o `provider_ext_id` para as próximas rodadas serem diretas.
 */
export async function syncContaAzulPagamentos(caseId?: string): Promise<{
  ok: boolean;
  pendentes: number;
  reconciliadas: number;
  atualizadas: number;
  nota?: string;
}> {
  const sb = getSupabaseAdmin();

  // 1) Parcelas locais conta_azul ainda PENDENTE.
  let query = sb
    .from("system_parcelas")
    .select("id, case_id, numero, valor_centavos, vencimento, provider_ext_id, status")
    .eq("provider", "conta_azul")
    .eq("status", "PENDENTE");
  if (caseId) query = query.eq("case_id", caseId);

  const { data: parcelasRaw, error } = await query;
  if (error) {
    console.error("syncContaAzulPagamentos: erro ao ler parcelas:", error.message);
    return { ok: false, pendentes: 0, reconciliadas: 0, atualizadas: 0, nota: error.message };
  }
  const pendentes = parcelasRaw ?? [];
  if (pendentes.length === 0) {
    return { ok: true, pendentes: 0, reconciliadas: 0, atualizadas: 0, nota: "Sem parcelas pendentes." };
  }

  // 2) case_code de cada caso (usado no matching por `nota`).
  const caseIds = [...new Set(pendentes.map((p) => p.case_id))];
  const { data: casos } = await sb
    .from("system_cases")
    .select("id, case_code")
    .in("id", caseIds);
  const caseCodeById = new Map<string, string>((casos ?? []).map((c) => [c.id, c.case_code]));

  // 3) Busca no Conta Azul as parcelas RECEBIDAS numa janela ampla de vencimento
  //    (o filtro de vencimento é obrigatório na API). Paginação defensiva.
  const hoje = new Date();
  const janelaDe = new Date(hoje);
  janelaDe.setFullYear(janelaDe.getFullYear() - 3);
  const janelaAte = new Date(hoje);
  janelaAte.setFullYear(janelaAte.getFullYear() + 3);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const recebidos: CAContaAReceberItem[] = [];
  try {
    for (let pagina = 1; pagina <= 20; pagina++) {
      const r = await buscarContasAReceber({
        pagina,
        tamanho_pagina: 500,
        data_vencimento_de: fmtDate(janelaDe),
        data_vencimento_ate: fmtDate(janelaAte),
        status: ["RECEBIDO", "RECEBIDO_PARCIAL"],
      });
      const itens = r.itens ?? [];
      recebidos.push(...itens);
      if (itens.length < 500 || recebidos.length >= (r.itens_totais ?? recebidos.length)) break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("syncContaAzulPagamentos: erro ao buscar contas a receber:", msg);
    return {
      ok: false,
      pendentes: pendentes.length,
      reconciliadas: 0,
      atualizadas: 0,
      nota: `Falha ao consultar Conta Azul: ${msg}`,
    };
  }

  // 4) Casa cada parcela pendente com um item recebido e dá baixa.
  let atualizadas = 0;
  let reconciliadas = 0;
  for (const p of pendentes) {
    const code = caseCodeById.get(p.case_id) ?? "";
    const match = recebidos.find((it) => matchParcela(it, p, code));
    if (!match) continue;

    const dataPg = caReadStr(match, ["data_pagamento", "dataPagamento"]) ?? fmtDate(hoje);
    const valorPagoReais = caReadNum(match, ["valor_pago", "valorPago", "valor"]);
    const extId = typeof match.id === "string" ? match.id : String(match.id ?? "");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (sb.from("system_parcelas") as any)
      .update({
        status: "PAGA",
        data_pagamento: dataPg,
        valor_pago_centavos:
          valorPagoReais != null ? Math.round(valorPagoReais * 100) : p.valor_centavos,
        provider_ext_id: extId || p.provider_ext_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);

    if (upErr) {
      console.error(`syncContaAzulPagamentos: erro ao baixar parcela ${p.id}:`, upErr.message);
      continue;
    }
    atualizadas++;
    if (!p.provider_ext_id && extId) reconciliadas++;
  }

  await sb.from("system_audit_log").insert({
    organization_id: DEFAULT_ORG,
    action: "contaazul.sync_pagamentos",
    entity_type: caseId ? "case" : "system",
    entity_id: caseId ?? DEFAULT_ORG,
    diff: {
      pendentes: pendentes.length,
      recebidos_no_ca: recebidos.length,
      reconciliadas,
      atualizadas,
    } as unknown as Json,
  });

  return { ok: true, pendentes: pendentes.length, reconciliadas, atualizadas };
}

// Casa um item de conta a receber do Conta Azul com uma parcela local.
function matchParcela(
  it: CAContaAReceberItem,
  parcela: { valor_centavos: number; vencimento: string; provider_ext_id: string | null },
  caseCode: string,
): boolean {
  // (a) reconciliação direta pelo id da parcela CA já gravado.
  if (parcela.provider_ext_id && String(it.id) === parcela.provider_ext_id) return true;

  // (b) heurística: o case_code (gravado em nota/descrição) + valor + vencimento.
  const texto = `${caReadStr(it, ["nota"]) ?? ""} ${caReadStr(it, ["descricao"]) ?? ""} ${
    caReadStr(it, ["observacao"]) ?? ""
  }`.toUpperCase();
  const codeBate = caseCode.length > 0 && texto.includes(caseCode.toUpperCase());
  if (!codeBate) return false;

  const valorReais = caReadNum(it, ["valor", "valor_pago"]);
  const valorBate =
    valorReais != null && Math.abs(Math.round(valorReais * 100) - parcela.valor_centavos) <= 1;

  const venc = caReadStr(it, ["data_vencimento"]);
  const vencBate = !!venc && venc.slice(0, 10) === parcela.vencimento.slice(0, 10);

  return valorBate && vencBate;
}

// Leitores defensivos (a doc lista os campos; os nomes exatos podem variar).
function caReadStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
}
function caReadNum(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Mapeia os valores da UI para os valores que a API do Conta Azul aceita.
const CA_PAYMENT_METHOD_MAP: Record<string, string> = {
  PIX: "PIX_PAGAMENTO_INSTANTANEO",
  BOLETO: "BOLETO_BANCARIO",
  TRANSFERENCIA: "TRANSFERENCIA_BANCARIA",
  // Estes já coincidem com o enum do CA:
  CARTAO_CREDITO: "CARTAO_CREDITO",
  DINHEIRO: "DINHEIRO",
  OUTRO: "OUTRO",
};

function mapPaymentMethod(method: string | undefined): string | undefined {
  if (!method) return undefined;
  return CA_PAYMENT_METHOD_MAP[method] ?? method;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
