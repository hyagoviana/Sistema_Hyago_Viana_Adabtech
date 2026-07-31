/**
 * Mock Projuris Adapter — Implementacao com dados ficticios
 *
 * Permite desenvolvimento sem credenciais do Projuris (CON-004).
 * Cenarios configuraveis: normal, high_volume, empty, errors.
 *
 * Story 2.1 — Epic 2
 */

import type {
  ProjurisAdapter, ProjurisTask, ProjurisProcess,
  ProjurisDeadline, ProjurisHistory, ProjurisDocument,
  WriteBackItem, WriteBackResult,
} from './projuris-adapter.ts';
import { MOCK_TASKS, MOCK_PROCESSES } from './mock-data/tasks.ts';

export type MockScenario = 'normal' | 'high_volume' | 'empty' | 'errors';

export class MockProjurisAdapter implements ProjurisAdapter {
  private scenario: MockScenario = 'normal';
  private writeBackCalls: WriteBackItem[][] = [];

  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  getWriteBackCalls(): WriteBackItem[][] {
    return this.writeBackCalls;
  }

  async fetchPendingTasks(_date: string): Promise<ProjurisTask[]> {
    await this.simulateLatency();
    if (this.scenario === 'errors') throw new Error('Projuris API indisponivel (mock)');
    if (this.scenario === 'empty') return [];
    if (this.scenario === 'high_volume') return this.generateHighVolume();
    return [...MOCK_TASKS];
  }

  async fetchProcess(processCode: string): Promise<ProjurisProcess> {
    await this.simulateLatency();
    if (this.scenario === 'errors') throw new Error('Projuris API indisponivel (mock)');
    const process = MOCK_PROCESSES[processCode];
    if (!process) throw new Error(`Processo ${processCode} nao encontrado (mock)`);
    return { ...process };
  }

  async fetchDeadlines(taskType: string, _date: string): Promise<ProjurisDeadline[]> {
    await this.simulateLatency();
    if (this.scenario === 'errors') throw new Error('Projuris API indisponivel (mock)');
    return MOCK_TASKS
      .filter(t => t.tipoTarefa.codigo === taskType && t.prazoFatal)
      .map(t => ({
        codigoTarefa: t.codigoProjuris,
        prazoFatal: t.prazoFatal!,
        prazoInterno: t.prazoInterno ?? t.prazoFatal!,
        tipo: t.tipoTarefa.codigo,
      }));
  }

  async fetchHistory(processCode: string): Promise<ProjurisHistory[]> {
    await this.simulateLatency();
    if (this.scenario === 'errors') throw new Error('Projuris API indisponivel (mock)');
    return [
      {
        codigoAndamento: `AND-${processCode}-001`,
        codigoProcesso: processCode,
        data: '2026-06-15T10:00:00-03:00',
        descricao: 'Peticao inicial protocolada',
        executor: 'RESP-A',
        tipoTarefa: 'INICIAL',
        conteudo: { texto: 'Protocolado com sucesso' },
      },
    ];
  }

  async fetchDocuments(taskCode: string): Promise<ProjurisDocument[]> {
    await this.simulateLatency();
    if (this.scenario === 'errors') throw new Error('Projuris API indisponivel (mock)');
    const task = MOCK_TASKS.find(t => t.codigoProjuris === taskCode);
    if (!task) return [];
    return task.documentos.map(d => ({
      ...d,
      codigoProcesso: task.codigoProcesso,
      codigoTarefa: task.codigoProjuris,
    }));
  }

  async downloadFile(_fileCode: string): Promise<Uint8Array> {
    await this.simulateLatency();
    if (this.scenario === 'errors') throw new Error('Projuris API indisponivel (mock)');
    // Retorna um PDF ficticio minimo
    return new TextEncoder().encode('%PDF-1.4 mock document content');
  }

  async addResponsibleBatch(items: WriteBackItem[]): Promise<WriteBackResult> {
    await this.simulateLatency();
    this.writeBackCalls.push([...items]);
    if (this.scenario === 'errors') {
      return { success: false, processedCount: 0, errors: items.map(i => ({ codigoTarefa: i.codigoTarefa, error: 'Mock error' })) };
    }
    return { success: true, processedCount: items.length, errors: [] };
  }

  async replaceResponsibleBatch(items: WriteBackItem[]): Promise<WriteBackResult> {
    await this.simulateLatency();
    this.writeBackCalls.push([...items]);
    if (this.scenario === 'errors') {
      return { success: false, processedCount: 0, errors: items.map(i => ({ codigoTarefa: i.codigoTarefa, error: 'Mock error' })) };
    }
    return { success: true, processedCount: items.length, errors: [] };
  }

  // ---------------------------------------------------------------------------
  // Helpers internos
  // ---------------------------------------------------------------------------

  private async simulateLatency(): Promise<void> {
    // Simula latencia minima para testes async
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  private generateHighVolume(): ProjurisTask[] {
    return Array.from({ length: 200 }, (_, i) => ({
      codigoProjuris: `T-HV-${String(i + 1).padStart(3, '0')}`,
      codigoProcesso: `P-${String((i % 6) + 1).padStart(3, '0')}`,
      tipoTarefa: MOCK_TASKS[i % MOCK_TASKS.length].tipoTarefa,
      prazoFatal: '2026-08-20',
      prazoInterno: '2026-08-15',
      ordemEntrada: i + 1,
      responsavelAtual: null,
      documentos: [],
    }));
  }
}
