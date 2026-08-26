// De-para entre o status de tarefa do SHV (TK1) e a situação de tarefa do ProJuris.
//
// Contexto (reunião 2026-08-26): o Thiago quis que a tarefa do SHV falasse a
// mesma língua da tarefa do ProJuris — "pendente, concluído com sucesso,
// concluído sem sucesso... é um identificador importante, porque a gente sabe de
// fato ali o que já foi feito".
//
// Códigos confirmados na integração (ver comentário em `criar-tarefa.ts`, que já
// vinha usando o 1 desde a primeira criação real — TAR.0042163):
//   1 = Pendente
//   2 = Concluída com sucesso
//
// O código de "concluída SEM sucesso" ainda NÃO foi confirmado contra a API.
// Enquanto não for, ele cai em "concluída" (flag `situacaoConcluida: true` com o
// código 2) — a tarefa fecha lá, que é o que importa para a agenda deles, e o
// desfecho fino continua registrado no SHV. Está anotado como pendência na story
// TK1 e no spike da FN2 (mesma família de perguntas à API).

import { isTaskConcluida } from "@/lib/task-status-shared";

export const PROJURIS_SITUACAO_PENDENTE = 1;
export const PROJURIS_SITUACAO_CONCLUIDA_SUCESSO = 2;

export interface ProjurisSituacao {
  codigoTarefaEventoSituacao: number;
  situacaoConcluida: boolean;
}

/**
 * Situação a enviar ao ProJuris para um status do SHV.
 * Sem status (ou status desconhecido) = tarefa nova = pendente lá.
 */
export function projurisSituacaoDoStatus(status?: string | null): ProjurisSituacao {
  if (isTaskConcluida(status)) {
    return {
      codigoTarefaEventoSituacao: PROJURIS_SITUACAO_CONCLUIDA_SUCESSO,
      situacaoConcluida: true,
    };
  }
  // EM_ANDAMENTO e CANCELADA continuam "pendentes" no ProJuris: cancelar é
  // decisão nossa, e não existe equivalente confirmado do lado de lá — fechar a
  // tarefa como "concluída" seria mentir para a agenda deles.
  return { codigoTarefaEventoSituacao: PROJURIS_SITUACAO_PENDENTE, situacaoConcluida: false };
}
