-- ROLLBACK — A4: remove a coluna `exclusive` de system_case_board_positions.
-- Restaura a view para o shape anterior (sem exclusive).
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/rollbacks/20260805000001_case_board_positions_exclusive.rollback.sql

CREATE OR REPLACE VIEW system_case_board_positions_active AS
  SELECT
    id, organization_id, case_id, board_id, stage_id, stage_slug,
    entered_at, created_at, updated_at, deleted_at
  FROM system_case_board_positions
  WHERE deleted_at IS NULL;

GRANT SELECT ON system_case_board_positions_active TO anon, authenticated, service_role;

DROP INDEX IF EXISTS idx_system_case_board_positions_exclusive;

ALTER TABLE system_case_board_positions
  DROP COLUMN IF EXISTS exclusive;
