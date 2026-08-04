-- Rollback A2 — remove `hidden_in_filters` de system_tema_field_defs e recria a view.
ALTER TABLE system_tema_field_defs
  DROP COLUMN IF EXISTS hidden_in_filters;

CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
