-- Adiciona assignee_id (FK para system_users) na tabela de tarefas do caso.
-- O campo TEXT 'assignee' permanece para backward-compat (será preenchido via trigger).
ALTER TABLE system_case_tasks
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES system_users(id);

-- Índice para buscar tarefas por usuário (dashboard "Hoje")
CREATE INDEX IF NOT EXISTS idx_system_case_tasks_assignee_id
  ON system_case_tasks(assignee_id)
  WHERE deleted_at IS NULL;

-- Trigger: ao inserir/atualizar assignee_id, copia o full_name para o campo TEXT assignee
CREATE OR REPLACE FUNCTION system_fn_sync_task_assignee_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    SELECT full_name INTO NEW.assignee
    FROM system_users WHERE id = NEW.assignee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_case_tasks_sync_assignee ON system_case_tasks;
CREATE TRIGGER trg_system_case_tasks_sync_assignee
  BEFORE INSERT OR UPDATE OF assignee_id ON system_case_tasks
  FOR EACH ROW
  EXECUTE FUNCTION system_fn_sync_task_assignee_name();

-- Recriar a view ativa para incluir assignee_id
DROP VIEW IF EXISTS system_case_tasks_active;
CREATE VIEW system_case_tasks_active AS
  SELECT * FROM system_case_tasks WHERE deleted_at IS NULL;
