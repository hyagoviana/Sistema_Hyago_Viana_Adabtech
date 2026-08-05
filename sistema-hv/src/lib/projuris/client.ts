// Cliente mínimo (server-only) da API REST do ProJuris ADV.
//
// FONTE (doc oficial, minerada em 2026-08-04 — story A9):
//   - URL de autenticação : https://apigw.projurisadv.com.br/auth/token  (Keycloak / OAuth2)
//   - URL dos serviços     : https://api.projurisadv.com.br/adv-service/
//     (o host legado https://api.sajadv.com.br/adv-service/ aponta pro mesmo serviço)
//
// FLUXO DE AUTH (grant_type=password, x-www-form-urlencoded):
//   POST /auth/token  com  grant_type, client_id, client_secret, username, password
//   → { access_token, expires_in, refresh_token, token_type: "Bearer", ... }
//   O `access_token` é então enviado nas chamadas seguintes no header
//   `Authorization: <access_token>` (a doc do ADV usa o token CRU, sem o prefixo
//   "Bearer "; por robustez tentamos cru e caímos p/ "Bearer <token>" em 401).
//
// SEGURANÇA: server-only. Lê segredos de process.env — NUNCA importe este módulo
// no bundle do browser. Em produção o app deve ler as credenciais da config do
// banco (system_distribution_config.projuris_*); este client aceita as credenciais
// por parâmetro OU por env (fallback de referência p/ scripts/diagnóstico).

export interface ProjurisCredentials {
  /** api_cliente_codigo enviado pelo suporte ProJuris. Vai como client_id. */
  clientId: string;
  /** client_secret enviado pelo suporte ProJuris. */
  clientSecret: string;
  /** Usuário ProJuris (SEM o domínio). */
  username?: string;
  /** Domínio do escritório (menu "Dados da conta" no ProJuris). */
  dominio?: string;
  /** Senha do usuário ProJuris. */
  password?: string;
  /** Override da URL de auth (default apigw.projurisadv.com.br/auth/token). */
  authUrl?: string;
  /** Override da base dos serviços (default api.projurisadv.com.br/adv-service). */
  baseUrl?: string;
}

export interface ProjurisTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
}

export const PROJURIS_DEFAULT_AUTH_URL = "https://apigw.projurisadv.com.br/auth/token";
export const PROJURIS_DEFAULT_BASE_URL = "https://api.projurisadv.com.br/adv-service";

/** Lê as credenciais do ambiente (fallback de referência p/ scripts). */
export function projurisCredentialsFromEnv(): ProjurisCredentials {
  return {
    clientId: process.env.PROJURIS_API_CLIENTE_CODIGO ?? "",
    clientSecret: process.env.PROJURIS_CLIENT_SECRET ?? "",
    username: process.env.PROJURIS_USERNAME || undefined,
    dominio: process.env.PROJURIS_DOMINIO || undefined,
    password: process.env.PROJURIS_PASSWORD || undefined,
    authUrl: process.env.PROJURIS_AUTH_URL || undefined,
    baseUrl: process.env.PROJURIS_BASE_URL || undefined,
  };
}

export class ProjurisAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "ProjurisAuthError";
  }
}

export class ProjurisClient {
  private readonly authUrl: string;
  private readonly baseUrl: string;
  private token: string | null = null;
  private tokenExpiresAt = 0; // epoch ms
  /** Se true, envia "Bearer <token>" em vez do token cru. */
  private useBearerPrefix = false;

  constructor(private readonly creds: ProjurisCredentials) {
    this.authUrl = (creds.authUrl || PROJURIS_DEFAULT_AUTH_URL).replace(/\/+$/, "");
    this.baseUrl = (creds.baseUrl || PROJURIS_DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /** username no formato exigido pelo ProJuris: USUARIO$$DOMINIO. */
  private buildUsername(): string {
    const u = (this.creds.username || "").trim();
    const d = (this.creds.dominio || "").trim();
    if (!u) return "";
    // Se o usuário já veio com "$$", respeita; senão junta com o domínio.
    if (u.includes("$$")) return u;
    return d ? `${u}$$${d}` : u;
  }

  /** Autentica (grant_type=password) e cacheia o token. */
  async authenticate(): Promise<ProjurisTokenResponse> {
    if (!this.creds.clientId || !this.creds.clientSecret) {
      throw new ProjurisAuthError(
        "PROJURIS_API_CLIENTE_CODIGO / PROJURIS_CLIENT_SECRET ausentes.",
        0,
        "",
      );
    }
    const username = this.buildUsername();
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: this.creds.clientId,
      client_secret: this.creds.clientSecret,
      username,
      password: this.creds.password ?? "",
    });

    const res = await fetch(this.authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ProjurisAuthError(
        `Falha na autenticação ProJuris (HTTP ${res.status}).`,
        res.status,
        text.slice(0, 800),
      );
    }
    const json = JSON.parse(text) as ProjurisTokenResponse;
    if (!json.access_token) {
      throw new ProjurisAuthError(
        "Resposta de auth sem access_token.",
        res.status,
        text.slice(0, 800),
      );
    }
    this.token = json.access_token;
    // Renova com 60s de folga antes do vencimento.
    this.tokenExpiresAt = Date.now() + Math.max(0, json.expires_in - 60) * 1000;
    return json;
  }

  private async ensureToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    await this.authenticate();
    return this.token!;
  }

  /** GET numa rota relativa a /adv-service. SÓ LEITURA. */
  async projurisGet<T = unknown>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const token = await this.ensureToken();
    const qs = query
      ? "?" +
        new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    const url = `${this.baseUrl}/${path.replace(/^\/+/, "")}${qs}`;

    const doFetch = (authValue: string) =>
      fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: authValue,
        },
      });

    let res = await doFetch(this.useBearerPrefix ? `Bearer ${token}` : token);
    // Se o token cru foi rejeitado, tenta uma vez com prefixo Bearer (e memoriza).
    if (res.status === 401 && !this.useBearerPrefix) {
      this.useBearerPrefix = true;
      res = await doFetch(`Bearer ${token}`);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} em GET ${path}: ${text.slice(0, 400)}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

/** Fábrica de conveniência a partir do ambiente. */
export function createProjurisClientFromEnv(): ProjurisClient {
  return new ProjurisClient(projurisCredentialsFromEnv());
}
