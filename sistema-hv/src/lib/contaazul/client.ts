// Cliente HTTP da API do Conta Azul (v2 — endpoints em português).
// SERVER-ONLY — nunca importar no browser (vaza o token).
// Base: https://api-v2.contaazul.com
// Auth: OAuth2 via Cognito (auth.contaazul.com).

import { getSupabaseAdmin } from "../supabase/server";
import type { ContaAzulTokenResponse } from "./types";

const API_BASE_URL = "https://api-v2.contaazul.com";
const AUTH_URL = "https://auth.contaazul.com/oauth2/token";
const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

// ─── Env ─────────────────────────────────────────────────────────────────────

function getEnv() {
  const clientId = process.env.CONTAAZUL_CLIENT_ID;
  const clientSecret = process.env.CONTAAZUL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ContaAzulError("Conta Azul: CONTAAZUL_CLIENT_ID e CONTAAZUL_CLIENT_SECRET ausentes.");
  }
  return { clientId, clientSecret };
}

// ─── Erro sanitizado ─────────────────────────────────────────────────────────

export class ContaAzulError extends Error {
  readonly status?: number;
  readonly safeBody?: string;

  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(sanitize(message));
    this.name = "ContaAzulError";
    this.status = opts?.status;
    this.safeBody = opts?.body ? sanitize(JSON.stringify(opts.body)).slice(0, 1000) : undefined;
  }

  toJSON() {
    return { name: this.name, message: this.message, status: this.status, body: this.safeBody };
  }
}

function sanitize(msg: string): string {
  if (!msg) return "";
  let out = msg;
  const secret = process.env.CONTAAZUL_CLIENT_SECRET;
  if (secret) out = out.split(secret).join("[REDACTED]");
  const token = process.env.CONTAAZUL_REFRESH_TOKEN;
  if (token) out = out.split(token).join("[REDACTED]");
  return out;
}

// ─── OAuth: trocar code por tokens ──────────────────────────────────────────

/**
 * Troca o authorization_code (obtido via redirect do Conta Azul) por
 * access_token + refresh_token. Salva ambos em system_integrations.
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const { clientId, clientSecret } = getEnv();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ContaAzulError(`Falha ao trocar code por token (${res.status}).`, {
      status: res.status,
      body,
    });
  }

  const data = (await res.json()) as ContaAzulTokenResponse;

  // Salva no DB
  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from("system_integrations").upsert(
    {
      organization_id: DEFAULT_ORG,
      provider: "conta_azul",
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider" },
  );

  // Atualiza cache em memória
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

// ─── Token Management ────────────────────────────────────────────────────────

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getEnv();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  // Buscar refresh_token do DB
  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integration } = await (sb as any)
    .from("system_integrations")
    .select("refresh_token")
    .eq("organization_id", DEFAULT_ORG)
    .eq("provider", "conta_azul")
    .maybeSingle();

  let refreshToken = (integration?.refresh_token as string | null) ?? null;

  // Fallback: env
  if (!refreshToken) {
    refreshToken = process.env.CONTAAZUL_REFRESH_TOKEN ?? null;
  }

  if (!refreshToken) {
    throw new ContaAzulError(
      "Conta Azul: refresh_token ausente. Faça o fluxo OAuth para autorizar.",
    );
  }

  let res: Response;
  try {
    res = await fetch(AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
  } catch (err) {
    throw new ContaAzulError(`Falha de rede ao renovar token: ${String(err)}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ContaAzulError(`Falha ao renovar token (${res.status}).`, {
      status: res.status,
      body,
    });
  }

  const data = (await res.json()) as ContaAzulTokenResponse;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  // Salvar novo refresh_token no DB
  if (data.refresh_token) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("system_integrations").upsert(
      {
        organization_id: DEFAULT_ORG,
        provider: "conta_azul",
        refresh_token: data.refresh_token,
        access_token: data.access_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );
  }

  return data.access_token;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  queryParams?: Record<string, string>,
): Promise<T> {
  const accessToken = await getAccessToken();
  let url = `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;

  if (queryParams) {
    const qs = new URLSearchParams(queryParams).toString();
    url += `?${qs}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ContaAzulError(`Falha de rede ao chamar ${method} ${path}: ${String(err)}`);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new ContaAzulError(`Conta Azul ${method} ${path} retornou ${res.status}.`, {
      status: res.status,
      body: parsed,
    });
  }
  return parsed as T;
}

// ─── Pessoas (Clientes) ─────────────────────────────────────────────────────

export type CAPessoa = {
  id: string;
  nome: string;
  documento?: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
  perfis: string[]; // ["Cliente"], ["Fornecedor"], etc.
  tipo_pessoa: "Física" | "Jurídica";
  data_criacao?: string;
  data_alteracao?: string;
  endereco?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
};

export type CAPessoaCreate = {
  nome: string;
  cpf?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  tipo_pessoa: "Física" | "Jurídica";
  perfis?: string[];
  endereco?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
};

type CAPessoaList = {
  totalItems: number;
  items: CAPessoa[];
};

export async function createPessoa(input: CAPessoaCreate): Promise<CAPessoa> {
  return request<CAPessoa>("POST", "v1/pessoas", input);
}

export async function getPessoa(id: string): Promise<CAPessoa> {
  return request<CAPessoa>("GET", `v1/pessoas/${id}`);
}

export async function updatePessoa(id: string, input: Partial<CAPessoaCreate>): Promise<CAPessoa> {
  return request<CAPessoa>("PUT", `v1/pessoas/${id}`, input);
}

export async function findPessoaByDocumento(documento: string): Promise<CAPessoa | null> {
  const result = await request<CAPessoaList>("GET", "v1/pessoas", undefined, {
    documento,
  });
  return result.items.length > 0 ? result.items[0] : null;
}

export async function listPessoas(params?: Record<string, string>): Promise<CAPessoaList> {
  return request<CAPessoaList>("GET", "v1/pessoas", undefined, params);
}

// ─── Serviços ────────────────────────────────────────────────────────────────

export type CAServico = {
  id: string;
  id_servico: number;
  descricao: string;
  preco: number;
  custo: number;
  status: "ATIVO" | "INATIVO";
  tipo_servico: "PRESTADO" | "TOMADO" | "AMBOS";
};

type CAServicoList = {
  itens: CAServico[];
  paginacao: { pagina_atual: number; total_paginas: number; total_itens: number };
};

export async function listServicos(): Promise<CAServicoList> {
  return request<CAServicoList>("GET", "v1/servicos");
}

export async function createServico(input: {
  descricao: string;
  preco: number;
  custo: number;
  tipo_servico: "PRESTADO" | "TOMADO" | "AMBOS";
}): Promise<CAServico> {
  return request<CAServico>("POST", "v1/servicos", input);
}

// ─── Financeiro: contas financeiras + eventos financeiros (contas a receber) ──

export type CAContaFinanceira = {
  id: string;
  nome?: string;
  tipo?: string;
  [k: string]: unknown;
};

// Lista as contas financeiras (ex.: "Receba Fácil"/Conta PJ). Vazio até o owner
// ativar uma conta que emita cobrança. Usada para pegar o `conta_financeira` id.
export async function listContasFinanceiras(): Promise<{
  itens: CAContaFinanceira[];
  itens_totais: number;
}> {
  return request("GET", "v1/conta-financeira");
}

export type CAMetodoPagamento =
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "BOLETO_BANCARIO"
  | "CARTAO_CREDITO_VIA_LINK"
  | "CHEQUE"
  | "CARTAO_DEBITO"
  | "TRANSFERENCIA_BANCARIA"
  | "OUTRO"
  | "CARTEIRA_DIGITAL"
  | "CASHBACK";

export type CABaixaInput = {
  data_pagamento: string; // YYYY-MM-DD
  composicao_valor: {
    valor_bruto: number; // obrigatório, >= 0
    multa?: number;
    juros?: number;
    desconto?: number;
    taxa?: number;
  };
  conta_financeira: string; // uuid
  metodo_pagamento?: CAMetodoPagamento;
  observacao?: string;
  nsu?: string;
};

// Registra a BAIXA (quitação) de uma parcela do Conta Azul. Doc oficial:
// POST /v1/financeiro/eventos-financeiros/parcelas/{parcela_id}/baixa
export async function criarBaixa(
  parcelaId: string,
  input: CABaixaInput,
): Promise<{ id: string; versao: number }> {
  return request(
    "POST",
    `v1/financeiro/eventos-financeiros/parcelas/${parcelaId}/baixa`,
    input,
  );
}

// ─── Conta a receber (cobrança) ──────────────────────────────────────────────

export type CAContaReceberParcela = {
  descricao: string;
  data_vencimento: string; // YYYY-MM-DD
  nota?: string;
  conta_financeira: string; // uuid
  detalhe_valor: {
    valor_bruto: number; // obrigatório
    multa?: number;
    juros?: number;
    valor_liquido?: number;
    desconto?: number;
    taxa?: number;
  };
  // Enum amplo (doc lista PIX_PAGAMENTO_INSTANTANEO etc.) — string p/ não engessar.
  metodo_pagamento?: string;
};

export type CAContaReceberInput = {
  data_competencia: string; // YYYY-MM-DD
  valor: number;
  observacao: string;
  descricao: string;
  contato: string; // uuid da PESSOA (cliente) no Conta Azul (contaazul_customer_id)
  conta_financeira: string; // uuid da conta financeira (Receba Fácil / Conta PJ)
  rateio?: Array<{
    id_categoria: string;
    valor: number;
    rateio_centro_custo?: Array<{ id_centro_custo: string; valor: number }>;
  }>;
  condicao_pagamento: { parcelas: CAContaReceberParcela[] };
};

// Resposta ASSÍNCRONA (202): devolve um protocolo. Os ids das parcelas criadas
// (usados depois na baixa) saem consultando o protocolo/listagem, não aqui.
export type CAContaReceberResponse = {
  protocolo: string;
  status: "PENDING" | "SUCCESS" | "ERROR";
  data_criacao: string;
};

// Cria um evento financeiro de contas a receber (cobrança). Doc oficial:
// POST /v1/financeiro/eventos-financeiros/contas-a-receber
export async function criarContaAReceber(
  input: CAContaReceberInput,
): Promise<CAContaReceberResponse> {
  return request("POST", "v1/financeiro/eventos-financeiros/contas-a-receber", input);
}

// ─── Consultar contas a receber (parcelas) ───────────────────────────────────

export type CAStatusContaAReceber =
  | "PERDIDO"
  | "RECEBIDO"
  | "EM_ABERTO"
  | "RENEGOCIADO"
  | "RECEBIDO_PARCIAL"
  | "ATRASADO";

// Uma PARCELA de conta a receber. Shape tipado de forma defensiva (campos
// opcionais + índice) porque a doc lista 15 propriedades cujos nomes exatos
// confirmamos ao ler a resposta real. Os leitores em service.ts usam fallback
// de nomes, então o matching não quebra se um campo vier com nome alternativo.
export type CAContaAReceberItem = {
  id: string;
  descricao?: string;
  nota?: string;
  observacao?: string;
  status?: CAStatusContaAReceber | string;
  valor?: number;
  valor_pago?: number;
  data_vencimento?: string;
  data_pagamento?: string | null;
  data_competencia?: string;
  cliente?: { id?: string; nome?: string };
  [k: string]: unknown;
};

export type BuscarContasAReceberFiltro = {
  pagina?: number;
  tamanho_pagina?: 10 | 20 | 50 | 100 | 200 | 500 | 1000;
  data_vencimento_de: string; // YYYY-MM-DD (OBRIGATÓRIO)
  data_vencimento_ate: string; // YYYY-MM-DD (OBRIGATÓRIO)
  data_pagamento_de?: string;
  data_pagamento_ate?: string;
  data_competencia_de?: string;
  data_competencia_ate?: string;
  valor_de?: string;
  valor_ate?: string;
  status?: CAStatusContaAReceber[];
  ids_clientes?: string[];
  ids_contas_financeiras?: string[];
};

export type BuscarContasAReceberResponse = {
  itens_totais: number;
  itens: CAContaAReceberItem[];
  totais?: { ativo: number; inativo: number; todos: number };
};

// Consulta as PARCELAS de contas a receber por filtros. Doc oficial:
// GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar
export async function buscarContasAReceber(
  f: BuscarContasAReceberFiltro,
): Promise<BuscarContasAReceberResponse> {
  const p = new URLSearchParams();
  p.set("pagina", String(f.pagina ?? 1));
  p.set("tamanho_pagina", String(f.tamanho_pagina ?? 500));
  p.set("data_vencimento_de", f.data_vencimento_de);
  p.set("data_vencimento_ate", f.data_vencimento_ate);
  if (f.data_pagamento_de) p.set("data_pagamento_de", f.data_pagamento_de);
  if (f.data_pagamento_ate) p.set("data_pagamento_ate", f.data_pagamento_ate);
  if (f.data_competencia_de) p.set("data_competencia_de", f.data_competencia_de);
  if (f.data_competencia_ate) p.set("data_competencia_ate", f.data_competencia_ate);
  if (f.valor_de) p.set("valor_de", f.valor_de);
  if (f.valor_ate) p.set("valor_ate", f.valor_ate);
  for (const s of f.status ?? []) p.append("status", s);
  for (const id of f.ids_clientes ?? []) p.append("ids_clientes", id);
  for (const id of f.ids_contas_financeiras ?? []) p.append("ids_contas_financeiras", id);

  return request(
    "GET",
    `v1/financeiro/eventos-financeiros/contas-a-receber/buscar?${p.toString()}`,
  );
}

// ─── Health check ────────────────────────────────────────────────────────────

export async function ping(): Promise<{ ok: true }> {
  await request<unknown>("GET", "v1/pessoas", undefined, { size: "1" });
  return { ok: true };
}
