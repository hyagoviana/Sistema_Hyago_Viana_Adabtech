// Cliente da API do ZapSign (assinatura eletrônica).
// Espelha o padrão de src/lib/google/drive.ts: getEnv() + erro sanitizado.
// SERVER-ONLY — nunca importar no browser (vaza o token).

const DEFAULT_BASE_URL = "https://sandbox.api.zapsign.com.br/api/v1";

function getEnv() {
  const token = process.env.ZAPSIGN_API_TOKEN;
  const baseUrl = (process.env.ZAPSIGN_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  if (!token) {
    throw new ZapSignError("ZapSign: ZAPSIGN_API_TOKEN ausente no ambiente.");
  }
  return { token, baseUrl };
}

// ----------------------------------------------------------------------------
// Erro sanitizado — esconde o token (UUID) de qualquer mensagem antes de logar.
// ----------------------------------------------------------------------------
export class ZapSignError extends Error {
  readonly status?: number;
  readonly safeBody?: string;

  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(sanitize(message));
    this.name = "ZapSignError";
    this.status = opts?.status;
    this.safeBody = opts?.body ? sanitize(JSON.stringify(opts.body)).slice(0, 1000) : undefined;
  }

  toJSON() {
    return { name: this.name, message: this.message, status: this.status, body: this.safeBody };
  }
}

// Remove o token do ambiente e qualquer UUID-like de uma string.
const UUID_LIKE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
function sanitize(msg: string): string {
  if (!msg) return "";
  let out = msg;
  const token = process.env.ZAPSIGN_API_TOKEN;
  if (token) out = out.split(token).join("[REDACTED_TOKEN]");
  return out.replace(UUID_LIKE, "[REDACTED]");
}

// ----------------------------------------------------------------------------
// HTTP helper
// ----------------------------------------------------------------------------
async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const { token, baseUrl } = getEnv();
  const url = `${baseUrl}/${path.replace(/^\/+/, "")}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ZapSignError(`Falha de rede ao chamar ${method} ${path}: ${String(err)}`);
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new ZapSignError(`ZapSign ${method} ${path} retornou ${res.status}.`, {
      status: res.status,
      body: parsed,
    });
  }
  return parsed as T;
}

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------
export type ZapSignAuthMode =
  | "assinaturaTela"
  | "tokenEmail"
  | "assinaturaTela-tokenEmail"
  | "tokenSms"
  | "tokenWhatsapp"
  | "certificadoDigital";

export type ZapSignSignerInput = {
  name: string;
  email?: string;
  phoneCountry?: string;
  phoneNumber?: string;
  authMode?: ZapSignAuthMode;
  sendAutomaticEmail?: boolean;
  sendAutomaticWhatsapp?: boolean;
  cpf?: string;
};

export type ZapSignCreateInput = {
  name: string;
  // exatamente uma das fontes:
  base64Pdf?: string;
  urlPdf?: string;
  base64Docx?: string;
  urlDocx?: string;
  lang?: "pt-br" | "es" | "en";
  externalId?: string; // p/ casar com system_case_documents
  signers: ZapSignSignerInput[];
};

export type ZapSignSigner = {
  token: string;
  sign_url: string;
  status: string;
  name: string;
  email: string | null;
  signed_at: string | null;
};

export type ZapSignDocument = {
  token: string;
  open_id: number;
  status: string; // pending | signed | refused | ...
  name: string;
  original_file: string | null;
  signed_file: string | null;
  created_at: string;
  external_id?: string | null;
  signers: ZapSignSigner[];
};

// ----------------------------------------------------------------------------
// Operações
// ----------------------------------------------------------------------------

/** Cria um documento no ZapSign a partir de um PDF/DOCX (base64 ou URL). */
export async function createDocument(input: ZapSignCreateInput): Promise<ZapSignDocument> {
  if (!input.base64Pdf && !input.urlPdf && !input.base64Docx && !input.urlDocx) {
    throw new ZapSignError("createDocument: informe base64Pdf, urlPdf, base64Docx ou urlDocx.");
  }
  const payload = {
    name: input.name,
    base64_pdf: input.base64Pdf,
    url_pdf: input.urlPdf,
    base64_docx: input.base64Docx,
    url_docx: input.urlDocx,
    lang: input.lang ?? "pt-br",
    external_id: input.externalId,
    signers: input.signers.map((s) => ({
      name: s.name,
      email: s.email,
      phone_country: s.phoneCountry,
      phone_number: s.phoneNumber,
      auth_mode: s.authMode ?? "assinaturaTela-tokenEmail",
      send_automatic_email: s.sendAutomaticEmail ?? false,
      send_automatic_whatsapp: s.sendAutomaticWhatsapp ?? false,
      cpf: s.cpf,
    })),
  };
  return request<ZapSignDocument>("POST", "/docs/", payload);
}

/** Lê o detalhe de um documento (status, signed_file etc.) pelo token. */
export async function getDocument(docToken: string): Promise<ZapSignDocument> {
  return request<ZapSignDocument>("GET", `/docs/${docToken}/`);
}

/** Verifica conectividade/autenticação sem criar dados (lista documentos). */
export async function ping(): Promise<{ ok: true; baseUrl: string }> {
  const { baseUrl } = getEnv();
  await request<unknown>("GET", "/docs/");
  return { ok: true, baseUrl };
}
