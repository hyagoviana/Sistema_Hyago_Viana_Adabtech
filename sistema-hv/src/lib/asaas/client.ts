// Cliente HTTP da API do Asaas (v3).
// SERVER-ONLY — nunca importar no browser (vaza a API key).
// Padrão espelhado de src/lib/zapsign/client.ts.

import type {
  AsaasCustomer,
  AsaasCustomerCreate,
  AsaasList,
  AsaasPayment,
  AsaasPaymentCreate,
  AsaasPixQrCode,
} from "./types";

const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_URL = "https://api.asaas.com/v3";

// ─── Env ─────────────────────────────────────────────────────────────────────

function getEnv() {
  const apiKey = process.env.ASAAS_API_KEY;
  const env = process.env.ASAAS_ENV || "sandbox";
  const baseUrl = env === "production" ? PRODUCTION_URL : SANDBOX_URL;

  if (!apiKey) {
    throw new AsaasError("Asaas: ASAAS_API_KEY ausente no ambiente.");
  }
  return { apiKey, baseUrl };
}

// ─── Erro sanitizado ─────────────────────────────────────────────────────────

export class AsaasError extends Error {
  readonly status?: number;
  readonly safeBody?: string;

  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(sanitize(message));
    this.name = "AsaasError";
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
  const key = process.env.ASAAS_API_KEY;
  if (key) out = out.split(key).join("[REDACTED_KEY]");
  return out;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const { apiKey, baseUrl } = getEnv();
  const url = `${baseUrl}/${path.replace(/^\/+/, "")}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new AsaasError(`Falha de rede ao chamar ${method} ${path}: ${String(err)}`);
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new AsaasError(`Asaas ${method} ${path} retornou ${res.status}.`, {
      status: res.status,
      body: parsed,
    });
  }
  return parsed as T;
}

// ─── Customers ───────────────────────────────────────────────────────────────

/** Cria um cliente no Asaas. */
export async function createCustomer(input: AsaasCustomerCreate): Promise<AsaasCustomer> {
  return request<AsaasCustomer>("POST", "customers", input);
}

/** Busca cliente por CPF/CNPJ. */
export async function findCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const result = await request<AsaasList<AsaasCustomer>>("GET", `customers?cpfCnpj=${cpfCnpj}`);
  return result.data.length > 0 ? result.data[0] : null;
}

/** Atualiza um cliente no Asaas. */
export async function updateCustomer(
  asaasId: string,
  input: Partial<AsaasCustomerCreate>,
): Promise<AsaasCustomer> {
  return request<AsaasCustomer>("PUT", `customers/${asaasId}`, input);
}

/** Busca um cliente pelo ID do Asaas. */
export async function getCustomer(asaasId: string): Promise<AsaasCustomer> {
  return request<AsaasCustomer>("GET", `customers/${asaasId}`);
}

// ─── Payments / Cobranças ────────────────────────────────────────────────────

/** Cria uma cobrança (avulsa ou parcelada). */
export async function createPayment(input: AsaasPaymentCreate): Promise<AsaasPayment> {
  return request<AsaasPayment>("POST", "payments", input);
}

/** Busca uma cobrança pelo ID do Asaas. */
export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return request<AsaasPayment>("GET", `payments/${paymentId}`);
}

/** Lista cobranças de um cliente. */
export async function listPaymentsByCustomer(
  customerId: string,
): Promise<AsaasList<AsaasPayment>> {
  return request<AsaasList<AsaasPayment>>("GET", `payments?customer=${customerId}`);
}

/** Deleta/cancela uma cobrança. */
export async function deletePayment(paymentId: string): Promise<{ deleted: boolean; id: string }> {
  return request<{ deleted: boolean; id: string }>("DELETE", `payments/${paymentId}`);
}

// ─── Installments (Parcelamentos) ───────────────────────────────────────────

/** Lista as cobranças individuais de um parcelamento. */
export async function listInstallmentPayments(
  installmentId: string,
): Promise<AsaasList<AsaasPayment>> {
  return request<AsaasList<AsaasPayment>>("GET", `installments/${installmentId}/payments`);
}

// ─── Pix ─────────────────────────────────────────────────────────────────────

/** Gera QR Code Pix para uma cobrança existente. */
export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return request<AsaasPixQrCode>("GET", `payments/${paymentId}/pixQrCode`);
}

// ─── Health check ────────────────────────────────────────────────────────────

/** Verifica conectividade/autenticação com o Asaas. */
export async function ping(): Promise<{ ok: true; baseUrl: string }> {
  const { baseUrl } = getEnv();
  await request<unknown>("GET", "customers?limit=1");
  return { ok: true, baseUrl };
}
