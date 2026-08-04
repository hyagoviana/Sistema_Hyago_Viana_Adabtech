-- ============================================================================
-- ROLLBACK — A3: Múltiplos Kanbans (boards/listas) por TEMA
-- ----------------------------------------------------------------------------
-- Remove as 2 tabelas novas + views + a coluna aditiva board_id de
-- system_pipeline_stages. NÃO toca system_cases, NÃO toca o trigger
-- system_fn_sync_stage_ids nem trg_system_cases_bifurcacao (nunca recriados aqui).
-- Aditiva pura → rollback limpo. Aplicar via db-apply-pg.ts.
-- ============================================================================

DROP VIEW IF EXISTS system_case_board_positions_active;
DROP TABLE IF EXISTS system_case_board_positions CASCADE;

-- Coluna aditiva de stages (FK ON DELETE CASCADE cai junto com o DROP TABLE abaixo,
-- mas dropamos a coluna explicitamente para não deixar resíduo).
DROP INDEX IF EXISTS idx_system_pipeline_stages_board;
ALTER TABLE system_pipeline_stages DROP COLUMN IF EXISTS board_id;

DROP VIEW IF EXISTS system_pipeline_boards_active;
DROP TABLE IF EXISTS system_pipeline_boards CASCADE;
