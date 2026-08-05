-- Rollback do executor exclusivo por TIPO/TEMA (20260805000002)
-- Remove as colunas exclusive_executor_id (o UPDATE de seed some junto com a coluna).

ALTER TABLE system_task_type_mapping DROP COLUMN IF EXISTS exclusive_executor_id;
ALTER TABLE system_theme_mapping     DROP COLUMN IF EXISTS exclusive_executor_id;
