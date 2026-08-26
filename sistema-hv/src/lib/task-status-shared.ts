// Status da TAREFA DO CASO (system_case_tasks) — vocabulário espelhado do ProJuris.
//
// TK1 (reunião 2026-08-26). O Thiago: "o ProJuris tem esses status de tarefa:
// pendente, concluído com sucesso, concluído sem sucesso... é um identificador
// importante, porque a gente sabe de fato ali o que já foi feito."
// O owner decidiu na mesma conversa TIRAR o "pendente": tarefa distribuída já é
// trabalho em andamento.
//
// Por que este arquivo existe separado de `dossie-service.ts`: o serviço importa
// `auth-guard`, que puxa `@tanstack/react-start/server`. Uma ROTA importando de
// lá levaria código de servidor para o bundle do cliente e o import-protection
// derruba o build (o `tsc` não pega — só o `vite build`). Mesma armadilha já
// documentada em `task-types-shared.ts`.
//
// Este módulo é PURO: sem imports, sem efeitos. Serve aos dois lados.
//
// NÃO CONFUNDIR: "PENDENTE" continua existindo, com outro significado, em
// system_parcelas (financeiro) e em system_distribution_movements (fila do
// motor). Nada aqui tem a ver com essas duas.

export const TASK_STATUSES = [
  "EM_ANDAMENTO",
  "CONCLUIDA_SUCESSO",
  "CONCLUIDA_SEM_SUCESSO",
  "CANCELADA",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA_SUCESSO: "Concluída com sucesso",
  CONCLUIDA_SEM_SUCESSO: "Concluída sem sucesso",
  CANCELADA: "Cancelada",
};

/** Rótulo tolerante: aceita status legado/desconhecido sem quebrar a tela. */
export function taskStatusLabel(status: string | null | undefined): string {
  if (!status) return "·";
  return TASK_STATUS_LABEL[status as TaskStatus] ?? status;
}

/** Concluída = com OU sem sucesso. As duas fecham `completed_at`. */
export function isTaskConcluida(status: string | null | undefined): boolean {
  return status === "CONCLUIDA_SUCESSO" || status === "CONCLUIDA_SEM_SUCESSO";
}

/**
 * Trabalho ABERTO — o que conta no contador do menu, na aba Tarefas, na
 * controladoria e nas exceções. Cancelada NÃO é conclusão, mas também não é
 * trabalho: some das listas de pendência sem entrar nas estatísticas de feito.
 */
export function isTaskAberta(status: string | null | undefined): boolean {
  return !isTaskConcluida(status) && status !== "CANCELADA";
}
