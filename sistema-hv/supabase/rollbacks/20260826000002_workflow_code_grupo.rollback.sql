-- ROLLBACK — W1 — remove identificador, grupo e o rastro do workflow na tarefa.
-- Perde o histórico de "qual workflow criou esta tarefa" (a coluna some).
DROP INDEX IF EXISTS idx_case_tasks_by_workflow;
ALTER TABLE system_case_tasks DROP COLUMN IF EXISTS created_by_workflow_id;

DROP INDEX IF EXISTS uq_workflow_rule_code;
ALTER TABLE system_workflow_rules
  DROP COLUMN IF EXISTS code,
  DROP COLUMN IF EXISTS group_name;
