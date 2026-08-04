-- Rollback A5 (5c) — remove `move_to_stage_slug` de system_tema_field_defs e recria a view.
ALTER TABLE system_tema_field_defs
  DROP COLUMN IF EXISTS move_to_stage_slug;

CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
