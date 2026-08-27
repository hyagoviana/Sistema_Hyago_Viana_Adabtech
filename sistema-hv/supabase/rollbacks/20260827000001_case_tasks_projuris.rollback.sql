-- Rollback simétrico do espelho de tarefa SHV ↔ ProJuris.
-- Perde o vínculo das tarefas já espelhadas: refazer exige reprocessar o motor.
DROP INDEX IF EXISTS idx_case_tasks_projuris_erro;
DROP INDEX IF EXISTS uq_case_tasks_projuris_codigo;

ALTER TABLE system_case_tasks
  DROP COLUMN IF EXISTS projuris_sync_error,
  DROP COLUMN IF EXISTS projuris_sync_at,
  DROP COLUMN IF EXISTS projuris_codigo_tarefa;
