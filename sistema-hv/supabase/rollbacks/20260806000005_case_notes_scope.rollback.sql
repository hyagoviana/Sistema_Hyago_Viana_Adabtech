-- Rollback simétrico da migration 20260806000005_case_notes_scope.sql (Story F1).
DROP INDEX IF EXISTS idx_system_case_notes_case_scope;

ALTER TABLE system_case_notes
  DROP CONSTRAINT IF EXISTS system_case_notes_scope_chk;

ALTER TABLE system_case_notes
  DROP COLUMN IF EXISTS scope;

CREATE OR REPLACE VIEW system_case_notes_active AS
  SELECT * FROM system_case_notes WHERE deleted_at IS NULL;

GRANT SELECT ON system_case_notes_active TO anon, authenticated, service_role;
