/**
 * Sistema de Alertas — Motor de Distribuicao de Tarefas Judiciais v1.0
 *
 * Geracao de alertas durante processamento de cada tarefa.
 * Alertas blocking bloqueiam a tarefa mas o batch continua.
 *
 * Referencia: regras_motor_distribuicao_v1.0.yaml, secao `alerts`
 *
 * Story 1.7 — Epic 1
 */

// ---------------------------------------------------------------------------
// Tipos (AC-11)
// ---------------------------------------------------------------------------

export type AlertSeverity = 'critical' | 'exceptional' | 'warning' | 'blocking';

export interface Alert {
  code: string;
  severity: AlertSeverity;
  message: string;
  task_id: string;
  blocked: boolean;
}

export interface AlertContext {
  task_id: string;
  distributionDate: string;
  fatalDate: string;
  internalLimitDate: string;
  finalDate: string | null;
  executorId: string | null;
  eligibleExecutorCount: number;
  /** Alertas ja coletados por outros modulos (date-engine, flow-selector) */
  existingAlertCodes: string[];
}

// ---------------------------------------------------------------------------
// Catalogo de alertas (spec YAML)
// ---------------------------------------------------------------------------

export const ALERT_CATALOG: Record<string, { severity: AlertSeverity; blocking: boolean; message: string }> = {
  'ALT-DATA-001': {
    severity: 'critical',
    blocking: false,
    message: 'Tarefa com prazo fatal no proprio dia da distribuicao (D+0)',
  },
  'ALT-DATA-002': {
    severity: 'exceptional',
    blocking: false,
    message: 'Tarefa com data final em D+1 (urgencia excepcional)',
  },
  'ALT-DATA-003': {
    severity: 'exceptional',
    blocking: false,
    message: 'Tarefa com data final em D+2 (urgencia excepcional)',
  },
  'ALT-PRAZO-001': {
    severity: 'warning',
    blocking: false,
    message: 'Limite interno incompativel no momento do recebimento',
  },
  'ALT-PRAZO-002': {
    severity: 'blocking',
    blocking: true,
    message: 'Prazo fatal anterior a data de distribuicao',
  },
  'ALT-CAD-001': {
    severity: 'blocking',
    blocking: true,
    message: 'Responsavel absoluto duplicado no mesmo nivel de precedencia',
  },
  'ALT-RESP-001': {
    severity: 'blocking',
    blocking: true,
    message: 'Responsavel absoluto sem data valida disponivel',
  },
  'ALT-RESP-002': {
    severity: 'blocking',
    blocking: true,
    message: 'Nenhum executor elegivel na janela de datas permitida',
  },
  'ALT-SYNC-001': {
    severity: 'warning',
    blocking: false,
    message: 'Write-back de responsavel no Projuris falhou (retry pendente)',
  },
};

// ---------------------------------------------------------------------------
// Geracao de alertas (AC-01)
// ---------------------------------------------------------------------------

/**
 * Gera alertas baseado no contexto da tarefa.
 * Alertas de data e prazo sao avaliados aqui.
 * ALT-CAD-001, ALT-RESP-001, ALT-RESP-002 podem vir via existingAlertCodes
 * (gerados por flow-selector e responsible-engine).
 */
export function generateAlerts(ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const seen = new Set<string>(ctx.existingAlertCodes);

  // ALT-PRAZO-002: fatal antes de D+0 (blocking)
  if (ctx.fatalDate < ctx.distributionDate && !seen.has('ALT-PRAZO-002')) {
    seen.add('ALT-PRAZO-002');
  }

  // ALT-PRAZO-001: limite interno incompativel
  if (ctx.internalLimitDate < ctx.distributionDate && !seen.has('ALT-PRAZO-001')) {
    seen.add('ALT-PRAZO-001');
  }

  // ALT-RESP-002: nenhum executor elegivel
  if (ctx.eligibleExecutorCount === 0 && !seen.has('ALT-RESP-002')) {
    seen.add('ALT-RESP-002');
  }

  // Converter todos os codigos em objetos Alert
  for (const code of seen) {
    const def = ALERT_CATALOG[code];
    if (def) {
      alerts.push({
        code,
        severity: def.severity,
        message: def.message,
        task_id: ctx.task_id,
        blocked: def.blocking,
      });
    }
  }

  return alerts;
}

/**
 * Verifica se algum alerta no array e blocking.
 */
export function hasBlockingAlert(alerts: Alert[]): boolean {
  return alerts.some((a) => a.blocked);
}

/**
 * Extrai apenas os codigos dos alertas (para persistencia em text[]).
 */
export function alertCodes(alerts: Alert[]): string[] {
  return alerts.map((a) => a.code);
}

/**
 * Cria um alerta avulso por codigo (util para modulos que geram alertas pontuais).
 */
export function createAlert(code: string, taskId: string): Alert {
  const def = ALERT_CATALOG[code];
  if (!def) {
    return {
      code,
      severity: 'warning',
      message: `Alerta desconhecido: ${code}`,
      task_id: taskId,
      blocked: false,
    };
  }
  return {
    code,
    severity: def.severity,
    message: def.message,
    task_id: taskId,
    blocked: def.blocking,
  };
}
