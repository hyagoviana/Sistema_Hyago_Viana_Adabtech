-- ============================================================================
-- ROLLBACK — A4 (2026-08-05): remove `parent_field_def_id` de system_tema_field_defs
-- ----------------------------------------------------------------------------
-- Simétrico a 20260806000002_tema_field_defs_parent.sql. Idempotente
-- (DROP ... IF EXISTS). Recria a view `_active` sem a coluna.
-- ============================================================================

DROP INDEX IF EXISTS idx_system_tema_field_defs_parent;

ALTER TABLE system_tema_field_defs
  DROP CONSTRAINT IF EXISTS system_tema_field_defs_parent_not_self_check;

ALTER TABLE system_tema_field_defs
  DROP COLUMN IF EXISTS parent_field_def_id;

-- Reexpande a view p/ refletir a remoção da coluna.
CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
