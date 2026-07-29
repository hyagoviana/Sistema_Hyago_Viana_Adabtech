/**
 * Projuris Adapter — Interface abstrata + Tipos v1.0
 *
 * Contrato de comunicacao com o Projuris (SajAdv).
 * Implementacoes: MockProjurisAdapter (dev), ProjurisRestAdapter (prod).
 *
 * Story 2.1 — Epic 2
 */

// ---------------------------------------------------------------------------
// Tipos Projuris (baseados nos payloads da API - PRD secao 6.1)
// ---------------------------------------------------------------------------

export interface ProjurisTask {
  codigoProjuris: string;
  codigoProcesso: string;
  tipoTarefa: {
    codigo: string;
    descricao: string;
    pontos: number | null;
  };
  prazoFatal: string | null; // date ISO or dd/MM/yyyy
  prazoInterno: string | null;
  ordemEntrada: number;
  responsavelAtual: string | null; // codigo do responsavel atual (para write-back replace)
  documentos: ProjurisDocumentRef[];
}

export interface ProjurisProcess {
  codigoProjuris: string;
  numero: string;
  tema: {
    codigo: string;
    descricao: string;
    multiplicador: number | null;
  };
  complexidade: number; // 0, 1, 2
  temporalidade: number; // 0, 1, 2
  responsavelDirecionado: string | null;
  executorExclusivoTema: string | null;
  executorExclusivoTipo: string | null;
  coletivo: boolean;
  partes: string[];
  comarca: string;
}

export interface ProjurisDeadline {
  codigoTarefa: string;
  prazoFatal: string;
  prazoInterno: string;
  tipo: string;
}

export interface ProjurisHistory {
  codigoAndamento: string;
  codigoProcesso: string;
  data: string;
  descricao: string;
  executor: string | null;
  tipoTarefa: string;
  conteudo: Record<string, unknown>;
}

export interface ProjurisDocumentRef {
  codigoArquivo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
}

export interface ProjurisDocument {
  codigoArquivo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  codigoProcesso: string;
  codigoTarefa: string | null;
}

export interface WriteBackItem {
  codigoTarefa: string;
  codigoResponsavel: string;
  codigoResponsavelAnterior?: string; // para replace
}

export interface WriteBackResult {
  success: boolean;
  processedCount: number;
  errors: Array<{ codigoTarefa: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Interface ProjurisAdapter (AC-01)
// ---------------------------------------------------------------------------

export interface ProjurisAdapter {
  /** POST /v2/tarefa/consulta-pendente-execucao */
  fetchPendingTasks(date: string): Promise<ProjurisTask[]>;

  /** GET /processo/{codigo-processo} */
  fetchProcess(processCode: string): Promise<ProjurisProcess>;

  /** GET /tarefa/prazo/tarefa-tipo/{tipo}/{data} */
  fetchDeadlines(taskType: string, date: string): Promise<ProjurisDeadline[]>;

  /** POST /andamento/consulta-geral */
  fetchHistory(processCode: string): Promise<ProjurisHistory[]>;

  /** Lista documentos associados a uma tarefa/processo */
  fetchDocuments(taskCode: string): Promise<ProjurisDocument[]>;

  /** GET /arquivo/{codigo-arquivo} */
  downloadFile(fileCode: string): Promise<Uint8Array>;

  /** PUT /v2/tarefa/adicionar-responsavel-em-lote */
  addResponsibleBatch(items: WriteBackItem[]): Promise<WriteBackResult>;

  /** PUT /v2/tarefa/substituir-responsavel-em-lote */
  replaceResponsibleBatch(items: WriteBackItem[]): Promise<WriteBackResult>;
}

// ---------------------------------------------------------------------------
// Seletor de adapter (AC-09)
// ---------------------------------------------------------------------------

export function createAdapter(env: Record<string, string>): ProjurisAdapter {
  if (env['PROJURIS_ADAPTER'] === 'rest') {
    // Lazy import para nao carregar rest adapter quando usando mock
    throw new Error('ProjurisRestAdapter requer credenciais (CON-004). Use PROJURIS_ADAPTER=mock ou configure credenciais.');
  }
  // Default: mock (CON-004)
  const { MockProjurisAdapter } = require('./projuris-mock-adapter.ts');
  return new MockProjurisAdapter();
}
