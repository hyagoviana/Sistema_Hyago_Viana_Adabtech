-- ============================================================================
-- Fix A3/#2 — a view system_pipeline_stages_active NÃO expunha `board_id`
-- (a migration 20260804000004 adicionou a coluna na TABELA mas não recriou a
-- view, que enumera colunas). Sem board_id na view, o app não distinguia as
-- etapas do kanban PRINCIPAL (board_id IS NULL) das de kanbans CUSTOM — e as
-- etapas custom vazavam para as colunas do principal.
--
-- CREATE OR REPLACE VIEW exige as MESMAS colunas na mesma ordem + novas SÓ no
-- fim → `board_id` é anexado ao final. Aditivo, reversível.
-- ============================================================================
CREATE OR REPLACE VIEW system_pipeline_stages_active AS
  SELECT
    id, organization_id, service_type_id, kind, slug, label, stage_role, color,
    ordem, active, created_at, updated_at, deleted_at,
    board_id
  FROM system_pipeline_stages
  WHERE deleted_at IS NULL;

GRANT SELECT ON system_pipeline_stages_active TO anon, authenticated, service_role;
