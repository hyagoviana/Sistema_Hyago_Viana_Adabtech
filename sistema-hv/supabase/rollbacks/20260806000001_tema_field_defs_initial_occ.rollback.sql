-- ============================================================================
-- ROLLBACK — A5 (2026-08-05): remove `initial_occurrences` de system_tema_field_defs
-- ----------------------------------------------------------------------------
-- Simétrico a 20260806000001_tema_field_defs_initial_occ.sql. Idempotente
-- (DROP ... IF EXISTS). Recria a view `_active` sem a coluna.
-- ============================================================================

ALTER TABLE system_tema_field_defs
  DROP CONSTRAINT IF EXISTS system_tema_field_defs_initial_le_max_check;
ALTER TABLE system_tema_field_defs
  DROP CONSTRAINT IF EXISTS system_tema_field_defs_initial_occ_check;

ALTER TABLE system_tema_field_defs
  DROP COLUMN IF EXISTS initial_occurrences;

-- Reexpande a view p/ refletir a remoção da coluna.
CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
