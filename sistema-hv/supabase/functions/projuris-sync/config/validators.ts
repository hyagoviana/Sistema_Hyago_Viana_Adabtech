/**
 * Validadores — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Funcoes de validacao que lancam erros descritivos.
 * Compativel com Deno.
 *
 * Story 1.2 — Epic 1
 */

import { ZodError } from 'npm:zod';
import { BatchInputSchema, TaskResultSchema, BatchOutputSchema } from './schemas.ts';
import type { BatchInput, TaskResult, BatchOutput } from './types.ts';

// ---------------------------------------------------------------------------
// Erro customizado de validacao
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  public readonly issues: Array<{ path: string; message: string }>;

  constructor(message: string, zodError: ZodError) {
    const issues = zodError.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));

    const details = issues
      .slice(0, 10)
      .map((i) => `  - ${i.path || '(root)'}: ${i.message}`)
      .join('\n');

    const truncated = issues.length > 10 ? `\n  ... e mais ${issues.length - 10} erros` : '';

    super(`${message}\n${details}${truncated}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// validateBatchInput (AC-12)
// ---------------------------------------------------------------------------

/**
 * Valida o input do Motor de Distribuicao.
 * Lanca `ValidationError` com detalhes se o payload nao estiver conforme o contrato.
 *
 * @param data - Payload desconhecido (ex: JSON parseado)
 * @returns BatchInput validado e tipado
 */
export function validateBatchInput(data: unknown): BatchInput {
  const result = BatchInputSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'BatchInput invalido: payload nao atende ao contrato v1.0',
      result.error
    );
  }
  return result.data as BatchInput;
}

// ---------------------------------------------------------------------------
// validateTaskResult
// ---------------------------------------------------------------------------

/**
 * Valida um resultado de tarefa individual.
 */
export function validateTaskResult(data: unknown): TaskResult {
  const result = TaskResultSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'TaskResult invalido: resultado de tarefa nao atende ao contrato v1.0',
      result.error
    );
  }
  return result.data as TaskResult;
}

// ---------------------------------------------------------------------------
// validateBatchOutput
// ---------------------------------------------------------------------------

/**
 * Valida a saida completa do Motor.
 */
export function validateBatchOutput(data: unknown): BatchOutput {
  const result = BatchOutputSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'BatchOutput invalido: saida do Motor nao atende ao contrato v1.0',
      result.error
    );
  }
  return result.data as BatchOutput;
}
