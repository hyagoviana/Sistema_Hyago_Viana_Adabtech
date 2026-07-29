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
  PROJURIS_AUTH_TYPE: 'basic' | 'bearer' | 'apikey';
  PROJURIS_USERNAME?: string;
  PROJURIS_PASSWORD?: string;
  PROJURIS_TOKEN?: string;
  PROJURIS_API_KEY?: string;
}

// ---------------------------------------------------------------------------
// REST Adapter
// ---------------------------------------------------------------------------

export class ProjurisRestAdapter implements ProjurisAdapter {
  private readonly baseUrl: string;
  private readonly authHeaders: Record<string, string>;
  private readonly processCache = new Map<string, ProjurisProcess>();

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000];
  private static readonly REQUEST_TIMEOUT = 30_000;
  private static readonly BATCH_CHUNK_SIZE = 50;

  constructor(env: Record<string, string>) {
    const config = env as unknown as ProjurisEnv;
    this.baseUrl = config.PROJURIS_BASE_URL;
    if (!this.baseUrl) throw new Error('PROJURIS_BASE_URL nao configurado');
    this.authHeaders = this.buildAuthHeaders(config);
  }

  // ---------------------------------------------------------------------------
  // Interface methods
  // ---------------------------------------------------------------------------

  async fetchPendingTasks(date: string): Promise<ProjurisTask[]> {
    const allTasks: ProjurisTask[] = [];
    let cursor: string | null = null;

    do {
      const body: Record<string, unknown> = { dataDistribuicao: date };
      if (cursor) body.cursor = cursor;

      const response = await this.post<{ data: ProjurisTask[]; nextCursor?: string }>(
        '/v2/tarefa/consulta-pendente-execucao', body
      );

      allTasks.push(...response.data);
      cursor = response.nextCursor ?? null;
    } while (cursor);

    return allTasks;
  }

  async fetchProcess(processCode: string): Promise<ProjurisProcess> {
    // Cache por batch
    const cached = this.processCache.get(processCode);
    if (cached) return cached;

    const process = await this.get<ProjurisProcess>(`/processo/${processCode}`);
    this.processCache.set(processCode, process);
    return process;
  }

  async fetchDeadlines(taskType: string, date: string): Promise<ProjurisDeadline[]> {
    return this.get<ProjurisDeadline[]>(`/tarefa/prazo/tarefa-tipo/${taskType}/${date}`);
  }

  async fetchHistory(processCode: string): Promise<ProjurisHistory[]> {
    const response = await this.post<{ data: ProjurisHistory[] }>(
      '/andamento/consulta-geral', { codigoProcesso: processCode }
    );
    return response.data;
  }

  async fetchDocuments(taskCode: string): Promise<ProjurisDocument[]> {
    return this.get<ProjurisDocument[]>(`/tarefa/${taskCode}/documentos`);
  }

  async downloadFile(fileCode: string): Promise<Uint8Array> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/arquivo/${fileCode}`, {
      method: 'GET',
      headers: this.authHeaders,
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

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchWithRetry(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { ...this.authHeaders, 'Content-Type': 'application/json' },
    });
    return response.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchWithRetry(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchWithRetry(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { ...this.authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
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

  private buildAuthHeaders(env: ProjurisEnv): Record<string, string> {
    switch (env.PROJURIS_AUTH_TYPE) {
      case 'basic':
        return { Authorization: 'Basic ' + btoa(`${env.PROJURIS_USERNAME}:${env.PROJURIS_PASSWORD}`) };
      case 'bearer':
        return { Authorization: `Bearer ${env.PROJURIS_TOKEN}` };
      case 'apikey':
        return { 'X-API-Key': env.PROJURIS_API_KEY ?? '' };
      default:
        throw new Error('PROJURIS_AUTH_TYPE deve ser basic, bearer ou apikey');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
