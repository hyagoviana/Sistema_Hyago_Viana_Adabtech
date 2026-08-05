/**
 * Projuris REST Adapter — Implementacao real da API Projuris (SajAdv)
 *
 * Consome endpoints REST com autenticacao, paginacao keyset,
 * retry com backoff exponencial e cache de processos.
 *
 * Depende de credenciais (CON-004 — pendente).
 *
 * Story 2.2 — Epic 2
 */

import type {
  ProjurisAdapter, ProjurisTask, ProjurisProcess,
  ProjurisDeadline, ProjurisHistory, ProjurisDocument,
  WriteBackItem, WriteBackResult,
} from './projuris-adapter.ts';

// ---------------------------------------------------------------------------
// Erro customizado
// ---------------------------------------------------------------------------

export class ProjurisApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
  ) {
    super(`ProjurisAPI [${statusCode}] ${endpoint}: ${message}`);
    this.name = 'ProjurisApiError';
  }
}

// ---------------------------------------------------------------------------
// Tipos de configuracao
// ---------------------------------------------------------------------------

interface ProjurisEnv {
  PROJURIS_BASE_URL: string;
  PROJURIS_AUTH_TYPE: 'basic' | 'bearer' | 'apikey' | 'oauth2_password';
  PROJURIS_USERNAME?: string;
  PROJURIS_PASSWORD?: string;
  PROJURIS_TOKEN?: string;
  PROJURIS_API_KEY?: string;
  // OAuth2 password grant (Keycloak) — auth REAL do ProJuris ADV.
  PROJURIS_AUTH_URL?: string;      // default apigw.projurisadv.com.br/auth/token
  PROJURIS_CLIENT_ID?: string;     // = api_cliente_codigo (string completa)
  PROJURIS_CLIENT_SECRET?: string;
  PROJURIS_DOMINIO?: string;       // dominio do escritorio (username = USUARIO$$DOMINIO)
}

const DEFAULT_AUTH_URL = 'https://apigw.projurisadv.com.br/auth/token';

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  refresh_token?: string;
}

// ---------------------------------------------------------------------------
// REST Adapter
// ---------------------------------------------------------------------------

export class ProjurisRestAdapter implements ProjurisAdapter {
  private readonly baseUrl: string;
  private readonly config: ProjurisEnv;
  private readonly processCache = new Map<string, ProjurisProcess>();

  // OAuth2 (Keycloak) — token cacheado + renovacao automatica.
  private oauthToken: string | null = null;
  private oauthTokenExpiresAt = 0; // epoch ms
  private useBearerPrefix = false; // ProJuris ADV usa token CRU; cai p/ Bearer em 401.

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000];
  private static readonly REQUEST_TIMEOUT = 30_000;
  private static readonly BATCH_CHUNK_SIZE = 50;

  constructor(env: Record<string, string>) {
    const config = env as unknown as ProjurisEnv;
    this.config = config;
    // Base dos servicos REST (adv-service). Se vier a base do apigw (auth),
    // corrige para a base de servicos real.
    let base = (config.PROJURIS_BASE_URL || '').replace(/\/+$/, '');
    if (!base) throw new Error('PROJURIS_BASE_URL nao configurado');
    if (base.includes('apigw.projurisadv.com.br')) {
      // apigw e host de AUTH, nao de servicos — usa a base REST correta.
      base = 'https://api.projurisadv.com.br/adv-service';
    }
    this.baseUrl = base;
  }

  // ---------------------------------------------------------------------------
  // OAuth2 password grant (auth REAL — Keycloak)
  // ---------------------------------------------------------------------------

  private buildOAuthUsername(): string {
    const u = (this.config.PROJURIS_USERNAME || '').trim();
    const d = (this.config.PROJURIS_DOMINIO || '').trim();
    if (!u) return '';
    if (u.includes('$$')) return u;
    // Doc do ADV: USUARIO$$DOMINIO. Se username veio como e-mail cru, tenta cru
    // primeiro (o suporte confirmou o e-mail completo como username valido).
    return u;
  }

  private async authenticateOAuth(): Promise<void> {
    const authUrl = (this.config.PROJURIS_AUTH_URL || DEFAULT_AUTH_URL).replace(/\/+$/, '');
    const clientId = this.config.PROJURIS_CLIENT_ID || '';
    const clientSecret = this.config.PROJURIS_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      throw new Error('OAuth2 ProJuris: PROJURIS_CLIENT_ID / PROJURIS_CLIENT_SECRET ausentes.');
    }
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: this.buildOAuthUsername(),
      password: this.config.PROJURIS_PASSWORD ?? '',
    });
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ProjurisApiError(text.slice(0, 400) || 'auth falhou', res.status, authUrl);
    }
    const json = JSON.parse(text) as OAuthTokenResponse;
    if (!json.access_token) {
      throw new ProjurisApiError('resposta de auth sem access_token', res.status, authUrl);
    }
    this.oauthToken = json.access_token;
    // Renova com 60s de folga.
    this.oauthTokenExpiresAt = Date.now() + Math.max(0, json.expires_in - 60) * 1000;
  }

  private async ensureOAuthToken(): Promise<string> {
    if (this.oauthToken && Date.now() < this.oauthTokenExpiresAt) return this.oauthToken;
    await this.authenticateOAuth();
    return this.oauthToken!;
  }

  /** Testa a conexao (auth). Retorna true se autenticou. Nao grava nada. */
  async ping(): Promise<boolean> {
    if (this.config.PROJURIS_AUTH_TYPE === 'oauth2_password') {
      await this.ensureOAuthToken();
      return true;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Interface methods
  // ---------------------------------------------------------------------------

  /**
   * Busca as INTIMACOES do periodo (entrada do motor) e as converte para
   * ProjurisTask. Endpoint REAL: POST /intimacao/consulta (LEITURA).
   *
   * A intimacao bruta traz PROCESSO + RESPONSAVEL(cod) + data + texto, mas NAO
   * traz tipo-de-tarefa/prazo diretamente — vem de `tarefasSugeridas`
   * (prazoPrevisto/prazoFatal/codigoTarefaTipo). Aqui geramos uma ProjurisTask
   * por tarefa sugerida (fallback: 1 tarefa por intimacao sem tipo).
   *
   * `date` e o dia-alvo (distribuicao); consultamos por janela ate esse dia.
   */
  async fetchPendingTasks(date: string): Promise<ProjurisTask[]> {
    // Janela: dos ultimos N dias ate `date`, por data de disponibilizacao.
    const windowDays = Number(this.config['PROJURIS_INTIMACAO_WINDOW_DAYS' as keyof ProjurisEnv] ?? 3) || 3;
    const end = date;
    const start = addDaysIso(date, -windowDays);

    const filtro = {
      tipoDataFiltroIntimacao: 'DATA_DA_DISPONIBILIZACAO',
      dataPeriodoInicial: start,
      dataPeriodoFinal: end,
      dadosOrigemFiltro: true,
    };

    const resp = await this.post<{
      totalRegistros?: number;
      intimacaoConsultaWs?: Array<Record<string, unknown>>;
    }>('/intimacao/consulta', filtro);

    const lista = resp.intimacaoConsultaWs ?? [];
    const tasks: ProjurisTask[] = [];
    let idx = 0;

    for (const it of lista) {
      const codigoProcesso = String(
        it.codigoProcesso ?? it.numeroProcesso ?? it.codigoIntimacao ?? `intimacao-${idx}`,
      );
      const respArr = (it.usuariosResponsaveis as Array<Record<string, unknown>> | undefined) ?? [];
      const responsavelAtual = respArr.length
        ? String(respArr[0].codigoUsuario ?? respArr[0].codigo ?? respArr[0].chave ?? '')
        : null;
      const sugeridas = (it.tarefasSugeridas as Array<Record<string, unknown>> | undefined) ?? [];

      const codigoIntimacao = String(it.codigoIntimacao ?? it.codigo ?? idx);

      if (sugeridas.length === 0) {
        // Sem tarefa sugerida — cria 1 tarefa "generica" (sera descartada no
        // transform se o tipo nao mapear, mas mantem contagem de entrada).
        tasks.push({
          codigoProjuris: `INT-${codigoIntimacao}`,
          codigoProcesso,
          tipoTarefa: { codigo: String(it.tipoIntimacao ?? ''), descricao: String(it.tipoIntimacao ?? ''), pontos: null },
          prazoFatal: msToIso(it.dataPrazoFatal) ?? msToIso(it.dataDisponibilizacao),
          prazoInterno: msToIso(it.dataPrazoPrevisto) ?? msToIso(it.dataDisponibilizacao),
          ordemEntrada: ++idx,
          responsavelAtual,
          documentos: [],
        });
        continue;
      }

      for (const ts of sugeridas) {
        tasks.push({
          codigoProjuris: `INT-${codigoIntimacao}-${String(ts.codigoTarefaTipo ?? ts.codigo ?? '')}`,
          codigoProcesso,
          tipoTarefa: {
            codigo: String(ts.codigoTarefaTipo ?? ts.codigoTipo ?? ts.codigo ?? ''),
            descricao: String(ts.nomeTarefaTipo ?? ts.descricao ?? ''),
            pontos: null,
          },
          prazoFatal: msToIso(ts.dataLimite ?? ts.prazoFatal ?? it.dataPrazoFatal),
          prazoInterno: msToIso(ts.dataConclusaoPrevista ?? ts.prazoPrevisto ?? it.dataPrazoPrevisto),
          ordemEntrada: ++idx,
          responsavelAtual,
          documentos: [],
        });
      }
    }

    return tasks;
  }

  async fetchProcess(processCode: string): Promise<ProjurisProcess> {
    // Cache por batch
    const cached = this.processCache.get(processCode);
    if (cached) return cached;

    // Endpoint REAL: GET /processo/{codigoProcesso}. `assunto` = TEMA (SHV usa o
    // NOME como projuris_tema_codigo). marcadorWs[] / campoDinamicoDadoWs[] extras.
    const raw = await this.get<Record<string, unknown>>(`/processo/${processCode}`);

    const assunto = raw.assunto ?? raw.nomeAssunto ?? '';
    const process: ProjurisProcess = {
      codigoProjuris: String(raw.codigoProcesso ?? processCode),
      numero: String(raw.numeroProcesso ?? raw.numero ?? ''),
      tema: {
        // projuris_tema_codigo no SHV = NOME do assunto.
        codigo: String(assunto),
        descricao: String(assunto),
        multiplicador: null,
      },
      complexidade: 0,
      temporalidade: 0,
      responsavelDirecionado: null,
      executorExclusivoTema: null,
      executorExclusivoTipo: null,
      coletivo: false,
      partes: [],
      comarca: String(raw.comarca ?? raw.orgao ?? ''),
    };
    this.processCache.set(processCode, process);
    return process;
  }

  async fetchDeadlines(_taskType: string, _date: string): Promise<ProjurisDeadline[]> {
    // Prazos vem das tarefas sugeridas / tarefa do processo; endpoint dedicado
    // nao usado no fluxo de intimacao. Retorna vazio (nao-critico).
    return [];
  }

  async fetchHistory(processCode: string): Promise<ProjurisHistory[]> {
    // Historico de preferencia via tarefas do processo (consulta-multi-modulo).
    // Endpoint REAL: GET /processo/{codigoProcesso}/tarefa/consulta-multi-modulo.
    try {
      const raw = await this.get<Record<string, unknown>>(
        `/processo/${processCode}/tarefa/consulta-multi-modulo`,
      );
      const arr = firstArrayDeep(raw);
      return arr.map((t) => {
        const tt = t as Record<string, unknown>;
        const respArr = (tt.usuariosResponsaveis as Array<Record<string, unknown>> | undefined) ?? [];
        const exec = respArr.length
          ? String(respArr[0].codigoUsuario ?? respArr[0].codigo ?? respArr[0].chave ?? '')
          : null;
        return {
          codigoAndamento: String(tt.codigoTarefa ?? ''),
          codigoProcesso: String(processCode),
          data: msToIso(tt.dataConclusao ?? tt.dataConclusaoPrevista) ?? '',
          descricao: String(tt.nomeTarefaTipo ?? ''),
          executor: exec,
          tipoTarefa: String(tt.codigoTarefaTipo ?? ''),
          conteudo: {},
        } as ProjurisHistory;
      });
    } catch {
      return [];
    }
  }

  async fetchDocuments(_taskCode: string): Promise<ProjurisDocument[]> {
    return [];
  }

  async downloadFile(fileCode: string): Promise<Uint8Array> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/arquivo/${fileCode}`, {
      method: 'GET',
      headers: await this.buildRequestHeaders(),
    });
    return new Uint8Array(await response.arrayBuffer());
  }

  async addResponsibleBatch(items: WriteBackItem[]): Promise<WriteBackResult> {
    return this.executeBatchWrite('/v2/tarefa/adicionar-responsavel-em-lote', items);
  }

  async replaceResponsibleBatch(items: WriteBackItem[]): Promise<WriteBackResult> {
    return this.executeBatchWrite('/v2/tarefa/substituir-responsavel-em-lote', items);
  }

  /** Limpa cache de processos (chamar entre batches) */
  clearCache(): void {
    this.processCache.clear();
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  /**
   * Monta os headers de auth. Para oauth2_password, garante o token e usa o
   * token CRU (fallback p/ "Bearer <token>" memorizado apos 401).
   */
  private async buildRequestHeaders(): Promise<Record<string, string>> {
    if (this.config.PROJURIS_AUTH_TYPE === 'oauth2_password') {
      const token = await this.ensureOAuthToken();
      return { Authorization: this.useBearerPrefix ? `Bearer ${token}` : token };
    }
    return this.buildStaticAuthHeaders(this.config);
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.authedFetch(`${this.baseUrl}${path}`, { method: 'GET' });
    return response.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.authedFetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const response = await this.authedFetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
  }

  /**
   * fetch com auth + retry. Em oauth2, se levar 401 com token cru, tenta uma vez
   * com prefixo "Bearer" e memoriza a preferencia (igual ao ProjurisClient do app).
   */
  private async authedFetch(url: string, init: RequestInit): Promise<Response> {
    const headers = {
      ...(await this.buildRequestHeaders()),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    try {
      return await this.fetchWithRetry(url, { ...init, headers });
    } catch (err) {
      // 401 no modo oauth cru -> tenta Bearer uma vez.
      if (
        this.config.PROJURIS_AUTH_TYPE === 'oauth2_password' &&
        !this.useBearerPrefix &&
        err instanceof ProjurisApiError &&
        err.statusCode === 401
      ) {
        this.useBearerPrefix = true;
        const retryHeaders = {
          ...(await this.buildRequestHeaders()),
          Accept: 'application/json',
          'Content-Type': 'application/json',
        };
        return this.fetchWithRetry(url, { ...init, headers: retryHeaders });
      }
      throw err;
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= ProjurisRestAdapter.MAX_RETRIES; attempt++) {
      const startMs = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ProjurisRestAdapter.REQUEST_TIMEOUT);

        const response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeout);

        const durationMs = Date.now() - startMs;
        console.log(JSON.stringify({ event: 'projuris_request', url, status: response.status, durationMs, attempt }));

        if (response.ok) return response;

        // Retry somente em 429 e 5xx
        if (response.status === 429 || response.status >= 500) {
          lastError = new ProjurisApiError(await response.text(), response.status, url);
          if (attempt < ProjurisRestAdapter.MAX_RETRIES) {
            await this.delay(ProjurisRestAdapter.RETRY_DELAYS[attempt]);
            continue;
          }
        }

        // 4xx (exceto 429) — nao retenta
        throw new ProjurisApiError(await response.text(), response.status, url);
      } catch (error) {
        if (error instanceof ProjurisApiError) throw error;
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < ProjurisRestAdapter.MAX_RETRIES) {
          await this.delay(ProjurisRestAdapter.RETRY_DELAYS[attempt]);
          continue;
        }
      }
    }

    throw lastError ?? new Error('ProjurisAPI: todas as tentativas falharam');
  }

  private async executeBatchWrite(path: string, items: WriteBackItem[]): Promise<WriteBackResult> {
    const results: WriteBackResult = { success: true, processedCount: 0, errors: [] };

    // Chunking de 50
    for (let i = 0; i < items.length; i += ProjurisRestAdapter.BATCH_CHUNK_SIZE) {
      const chunk = items.slice(i, i + ProjurisRestAdapter.BATCH_CHUNK_SIZE);
      try {
        const chunkResult = await this.put<WriteBackResult>(path, chunk);
        results.processedCount += chunkResult.processedCount;
        results.errors.push(...chunkResult.errors);
      } catch (error) {
        results.success = false;
        for (const item of chunk) {
          results.errors.push({
            codigoTarefa: item.codigoTarefa,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (results.errors.length > 0) results.success = false;
    return results;
  }

  private buildStaticAuthHeaders(env: ProjurisEnv): Record<string, string> {
    switch (env.PROJURIS_AUTH_TYPE) {
      case 'basic':
        return { Authorization: 'Basic ' + btoa(`${env.PROJURIS_USERNAME}:${env.PROJURIS_PASSWORD}`) };
      case 'bearer':
        return { Authorization: `Bearer ${env.PROJURIS_TOKEN}` };
      case 'apikey':
        return { 'X-API-Key': env.PROJURIS_API_KEY ?? '' };
      default:
        throw new Error('PROJURIS_AUTH_TYPE deve ser basic, bearer, apikey ou oauth2_password');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Helpers de normalizacao (fora da classe)
// ---------------------------------------------------------------------------

/** Soma dias a uma data ISO YYYY-MM-DD (UTC-safe). */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Converte epoch-ms (ou ISO/BR) para ISO YYYY-MM-DD; null se ausente. */
function msToIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    if (v.includes('T')) return v.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  return null;
}

/** Retorna o 1o array encontrado (busca recursiva) num envelope da API ADV. */
function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') {
        const inner = firstArrayDeep(v);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}
