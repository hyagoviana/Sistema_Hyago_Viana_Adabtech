/**
 * Dados ficticios de tarefas Projuris para MockAdapter.
 * Cobre: diferentes tipos, temas, complexidades, temporalidades,
 * processos com/sem responsavel direcionado.
 */

import type { ProjurisTask, ProjurisProcess } from '../projuris-adapter.ts';

export const MOCK_TASKS: ProjurisTask[] = [
  { codigoProjuris: 'T-001', codigoProcesso: 'P-001', tipoTarefa: { codigo: 'INICIAL', descricao: 'Peticao Inicial', pontos: 10 }, prazoFatal: '2026-08-15', prazoInterno: '2026-08-12', ordemEntrada: 1, responsavelAtual: null, documentos: [{ codigoArquivo: 'DOC-001', nomeArquivo: 'peticao_inicial.pdf', mimeType: 'application/pdf', tamanhoBytes: 102400 }] },
  { codigoProjuris: 'T-002', codigoProcesso: 'P-001', tipoTarefa: { codigo: 'CONTESTACAO', descricao: 'Contestacao', pontos: 12 }, prazoFatal: '2026-08-10', prazoInterno: '2026-08-08', ordemEntrada: 2, responsavelAtual: null, documentos: [] },
  { codigoProjuris: 'T-003', codigoProcesso: 'P-002', tipoTarefa: { codigo: 'REPLICA', descricao: 'Replica', pontos: 8 }, prazoFatal: '2026-08-20', prazoInterno: '2026-08-18', ordemEntrada: 3, responsavelAtual: 'RESP-A', documentos: [] },
  { codigoProjuris: 'T-004', codigoProcesso: 'P-002', tipoTarefa: { codigo: 'DESPACHO', descricao: 'Despacho', pontos: 3 }, prazoFatal: '2026-07-29', prazoInterno: '2026-07-29', ordemEntrada: 4, responsavelAtual: null, documentos: [] },
  { codigoProjuris: 'T-005', codigoProcesso: 'P-003', tipoTarefa: { codigo: 'AGRAVO_DE_INSTRUMENTO', descricao: 'Agravo de Instrumento', pontos: 15 }, prazoFatal: '2026-08-05', prazoInterno: '2026-08-03', ordemEntrada: 5, responsavelAtual: null, documentos: [{ codigoArquivo: 'DOC-002', nomeArquivo: 'agravo.pdf', mimeType: 'application/pdf', tamanhoBytes: 256000 }] },
  { codigoProjuris: 'T-006', codigoProcesso: 'P-003', tipoTarefa: { codigo: 'APELACAO', descricao: 'Apelacao', pontos: 18 }, prazoFatal: '2026-08-25', prazoInterno: '2026-08-20', ordemEntrada: 6, responsavelAtual: null, documentos: [] },
  { codigoProjuris: 'T-007', codigoProcesso: 'P-004', tipoTarefa: { codigo: 'EMBARGOS_DE_DECLARACAO', descricao: 'Embargos de Declaracao', pontos: 6 }, prazoFatal: '2026-08-02', prazoInterno: '2026-08-01', ordemEntrada: 7, responsavelAtual: 'RESP-B', documentos: [] },
  { codigoProjuris: 'T-008', codigoProcesso: 'P-005', tipoTarefa: { codigo: 'RECURSO_INOMINADO', descricao: 'Recurso Inominado', pontos: 14 }, prazoFatal: '2026-08-18', prazoInterno: '2026-08-15', ordemEntrada: 8, responsavelAtual: null, documentos: [] },
  { codigoProjuris: 'T-009', codigoProcesso: 'P-005', tipoTarefa: { codigo: 'INICIAL', descricao: 'Peticao Inicial', pontos: 10 }, prazoFatal: '2026-07-28', prazoInterno: '2026-07-28', ordemEntrada: 9, responsavelAtual: null, documentos: [] },
  { codigoProjuris: 'T-010', codigoProcesso: 'P-006', tipoTarefa: { codigo: 'DESPACHO', descricao: 'Despacho', pontos: 3 }, prazoFatal: '2026-09-01', prazoInterno: '2026-08-28', ordemEntrada: 10, responsavelAtual: null, documentos: [] },
];

export const MOCK_PROCESSES: Record<string, ProjurisProcess> = {
  'P-001': { codigoProjuris: 'P-001', numero: '0001234-56.2026.8.01.0001', tema: { codigo: 'TRABALHISTA', descricao: 'Trabalhista', multiplicador: 1.2 }, complexidade: 0, temporalidade: 0, responsavelDirecionado: null, executorExclusivoTema: null, executorExclusivoTipo: null, coletivo: false, partes: ['Joao Silva'], comarca: 'SP' },
  'P-002': { codigoProjuris: 'P-002', numero: '0002345-67.2026.8.01.0002', tema: { codigo: 'CIVIL', descricao: 'Civil', multiplicador: 1.0 }, complexidade: 1, temporalidade: 1, responsavelDirecionado: 'RESP-DIRIGIDO-1', executorExclusivoTema: null, executorExclusivoTipo: null, coletivo: true, partes: ['Maria Santos', 'Pedro Lima'], comarca: 'RJ' },
  'P-003': { codigoProjuris: 'P-003', numero: '0003456-78.2026.8.01.0003', tema: { codigo: 'TRIBUTARIO', descricao: 'Tributario', multiplicador: 1.5 }, complexidade: 2, temporalidade: 2, responsavelDirecionado: null, executorExclusivoTema: 'RESP-TEMA-TRIB', executorExclusivoTipo: null, coletivo: false, partes: ['Empresa X'], comarca: 'DF' },
  'P-004': { codigoProjuris: 'P-004', numero: '0004567-89.2026.8.01.0004', tema: { codigo: 'TRABALHISTA', descricao: 'Trabalhista', multiplicador: 1.2 }, complexidade: 0, temporalidade: 0, responsavelDirecionado: null, executorExclusivoTema: null, executorExclusivoTipo: null, coletivo: false, partes: ['Ana Costa'], comarca: 'MG' },
  'P-005': { codigoProjuris: 'P-005', numero: '0005678-90.2026.8.01.0005', tema: { codigo: 'CIVIL', descricao: 'Civil', multiplicador: 1.0 }, complexidade: 0, temporalidade: 2, responsavelDirecionado: null, executorExclusivoTema: null, executorExclusivoTipo: null, coletivo: false, partes: ['Carlos Mendes'], comarca: 'BA' },
  'P-006': { codigoProjuris: 'P-006', numero: '0006789-01.2026.8.01.0006', tema: { codigo: 'TRIBUTARIO', descricao: 'Tributario', multiplicador: 1.5 }, complexidade: 1, temporalidade: 0, responsavelDirecionado: null, executorExclusivoTema: null, executorExclusivoTipo: null, coletivo: true, partes: ['Grupo Y', 'Grupo Z'], comarca: 'RS' },
};
