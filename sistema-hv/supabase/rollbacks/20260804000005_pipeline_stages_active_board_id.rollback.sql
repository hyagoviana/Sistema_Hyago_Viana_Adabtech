-- Rollback: view system_pipeline_stages_active volta a NÃO expor board_id.
CREATE OR REPLACE VIEW system_pipeline_stages_active AS
  SELECT
    id, organization_id, service_type_id, kind, slug, label, stage_role, color,
    ordem, active, created_at, updated_at, deleted_at
  FROM system_pipeline_stages
  WHERE deleted_at IS NULL;

GRANT SELECT ON system_pipeline_stages_active TO anon, authenticated, service_role;
