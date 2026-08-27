// De-para entre o status de tarefa do SHV (TK1) e a situação de tarefa do ProJuris.
//
// Contexto (reunião 2026-08-26): o Thiago quis que a tarefa do SHV falasse a
// mesma língua da tarefa do ProJuris — "pendente, concluído com sucesso,
// concluído sem sucesso... é um identificador importante, porque a gente sabe de
// fato ali o que já foi feito".
//
// CÓDIGOS CONFIRMADOS contra a API em 2026-08-27, lendo tarefas reais do
// escritório (`scripts/diag-projuris-situacao-tarefa.ts`, só leitura). O Thiago
// não conseguia ver esses códigos pelo painel — são configuração padrão do
// ProJuris — mas mandou o identificador de uma tarefa que estava em "concluída
// sem sucesso", e o campo `codigoSituacao` da resposta entregou o número:
//
//   1 = Pendente                  (TAR.0041754, flagSituacaoConcluida: false)
//   2 = Concluída com sucesso     (varredura)
//   3 = Concluída sem sucesso     (TAR.0042154, flagSituacaoConcluida: true)
//   5 = Cancelado                 (varredura)
//
// Os outros três do menu (Em execução, A confirmar, Revisão) ocupam 4, 6 e 7 se
// o enum seguir a ordem da tela — NÃO confirmado, nenhuma tarefa do escritório
// estava nesses estados. Não dependa disso sem sondar antes.

import { isTaskConcluida } from "@/lib/task-status-shared";

export const PROJURIS_SITUACAO_PENDENTE = 1;
export const PROJURIS_SITUACAO_CONCLUIDA_SUCESSO = 2;
export const PROJURIS_SITUACAO_CONCLUIDA_SEM_SUCESSO = 3;
export const PROJURIS_SITUACAO_CANCELADO = 5;

export interface ProjurisSituacao {
  codigoTarefaEventoSituacao: number;
  situacaoConcluida: boolean;
}

/**
 * Situação a enviar ao ProJuris para um status do SHV.
 * Sem status (ou status desconhecido) = tarefa nova = pendente lá.
 */
export function projurisSituacaoDoStatus(status?: string | null): ProjurisSituacao {
  switch (status) {
    case "CONCLUIDA_SUCESSO":
      return {
        codigoTarefaEventoSituacao: PROJURIS_SITUACAO_CONCLUIDA_SUCESSO,
        situacaoConcluida: true,
      };
    case "CONCLUIDA_SEM_SUCESSO":
      return {
        codigoTarefaEventoSituacao: PROJURIS_SITUACAO_CONCLUIDA_SEM_SUCESSO,
        situacaoConcluida: true,
      };
    case "CANCELADA":
      // "Cancelado" no ProJuris não conta como concluída — a tarefa sai da
      // agenda sem virar produção. É a leitura que bate com a do SHV.
      return {
        codigoTarefaEventoSituacao: PROJURIS_SITUACAO_CANCELADO,
        situacaoConcluida: false,
      };
    default:
      // EM_ANDAMENTO e qualquer valor desconhecido: pendente.
      // (Existe "Em execução" no menu do ProJuris, mas o código não foi
      // confirmado; pendente é o comportamento que já rodava em produção.)
      return {
        codigoTarefaEventoSituacao: PROJURIS_SITUACAO_PENDENTE,
        situacaoConcluida: false,
      };
  }
}

/** Mantida para quem só precisa saber se fecha a tarefa lá. */
export function projurisFechaTarefa(status?: string | null): boolean {
  return isTaskConcluida(status);
}
