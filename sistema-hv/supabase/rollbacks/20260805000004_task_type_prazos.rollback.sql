-- ============================================================================
-- ROLLBACK — H6: prazos internos por tipo de tarefa
-- Reverte 20260805000004_task_type_prazos.sql (aditivo).
-- ============================================================================

ALTER TABLE system_task_type_mapping
  DROP COLUMN IF EXISTS prazo_previsto_dias,
  DROP COLUMN IF EXISTS prazo_fatal_dias;
