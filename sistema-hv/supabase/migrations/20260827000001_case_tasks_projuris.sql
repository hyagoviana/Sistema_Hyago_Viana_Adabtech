-- ============================================================================
-- Sistema HV — Migration — Espelho de tarefa SHV ↔ ProJuris (ADITIVA)
-- ----------------------------------------------------------------------------
-- Decisão do owner (2026-08-27), confirmando o que o Thiago pediu:
--   "a ideia é concluir a tarefa no sistema ao invés do ProJuris, e se possível
--    espelhar no ProJuris a conclusão."
--
-- O PROBLEMA QUE ISTO RESOLVE. Até aqui os dois mundos não se cruzavam em ponto
-- nenhum: a tarefa que a pessoa cria e conclui na ficha do caso
-- (`system_case_tasks`) nunca saía do SHV, e a tarefa que o motor manda para o
-- ProJuris vive em `system_distribution_staging` e não aparece na agenda de
-- ninguém aqui dentro. Sem um vínculo, "concluir aqui reflete lá" não tinha nem
-- por onde acontecer.
--
-- `projuris_codigo_tarefa` guarda o **codigoTarefaEvento** (não o `codigoTarefa`
-- — são números diferentes na API, e usar o errado faz a chamada responder 204
-- sem fazer nada; ver `docs/referencia-api-projuris.md`).
--
-- A presença desse código é a REGRA que responde à preocupação do Thiago sobre
-- gente do administrativo que não tem usuário no ProJuris: só espelha a tarefa
-- que nasceu lá. Sem código, a tarefa vive só aqui, e está tudo certo.
--
-- Os dois carimbos de sync existem porque o `PUT /tarefas-situacao` responde 204
-- para qualquer coisa, inclusive quando não altera nada. O código confere lendo
-- de volta e registra aqui o que aconteceu — sem isso, a falha seria silenciosa.
-- ============================================================================

ALTER TABLE system_case_tasks
  ADD COLUMN IF NOT EXISTS projuris_codigo_tarefa TEXT,
  ADD COLUMN IF NOT EXISTS projuris_sync_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS projuris_sync_error    TEXT;

COMMENT ON COLUMN system_case_tasks.projuris_codigo_tarefa IS
  'codigoTarefaEvento da tarefa no ProJuris. NULL = tarefa que só existe no SHV.';
COMMENT ON COLUMN system_case_tasks.projuris_sync_at IS
  'Quando a situação foi espelhada no ProJuris COM CONFIRMAÇÃO (leitura de volta).';
COMMENT ON COLUMN system_case_tasks.projuris_sync_error IS
  'Motivo da última falha de espelho. NULL quando o último espelho deu certo.';

-- Uma tarefa do ProJuris não pode estar espelhada em duas tarefas do SHV: seria
-- duas pessoas concluindo o mesmo trabalho e a última sobrescrevendo a outra.
-- Parcial porque a esmagadora maioria das tarefas é só do SHV (código NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_tasks_projuris_codigo
  ON system_case_tasks (projuris_codigo_tarefa)
  WHERE projuris_codigo_tarefa IS NOT NULL AND deleted_at IS NULL;

-- Busca pelas tarefas que precisam de atenção de sync (erro pendente).
CREATE INDEX IF NOT EXISTS idx_case_tasks_projuris_erro
  ON system_case_tasks (projuris_sync_error)
  WHERE projuris_sync_error IS NOT NULL AND deleted_at IS NULL;
