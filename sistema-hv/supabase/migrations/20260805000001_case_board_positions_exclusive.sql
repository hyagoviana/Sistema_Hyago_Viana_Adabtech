-- ============================================================================
-- Sistema HV — Migration — A4: MOVER exclusivo vs DUPLICAR aditivo (kanbans)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-03 (decisão travada do owner): "mover/transferir" faz o caso
-- SAIR do kanban de origem (inclusive do principal) e ir SÓ para o destino;
-- "duplicar" mantém nos dois. Hoje o modelo era 100% aditivo (o caso ficava
-- sempre no principal), por isso não dava para "voltar ao principal".
--
-- SOLUÇÃO ADITIVA/idempotente (regressão ZERO p/ os 381 casos importados):
--   - Nova coluna `exclusive BOOLEAN NOT NULL DEFAULT FALSE` em
--     system_case_board_positions.
--   - `exclusive=true`  = o caso foi MOVIDO exclusivamente para este board custom
--     → deve SUMIR do principal (e dos outros boards).
--   - `exclusive=false` = o caso foi DUPLICADO neste board → segue no principal.
--   - Como o DEFAULT é FALSE, TODAS as posições existentes (e a ausência de
--     posição, caso dos 381) => o caso aparece no principal. Regressão zero.
--
-- A view system_case_board_positions_active enumera colunas → recriada com a
-- coluna nova anexada ao fim (CREATE OR REPLACE exige mesma ordem + novas no fim).
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260805000001_case_board_positions_exclusive.sql
-- Rollback:
--   npx tsx scripts/db-apply-pg.ts supabase/rollbacks/20260805000001_case_board_positions_exclusive.rollback.sql
-- ============================================================================

ALTER TABLE system_case_board_positions
  ADD COLUMN IF NOT EXISTS exclusive BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice p/ o NOT EXISTS do PrincipalKanban (excluir casos movidos p/ fora):
-- posições ATIVAS e EXCLUSIVAS por caso.
CREATE INDEX IF NOT EXISTS idx_system_case_board_positions_exclusive
  ON system_case_board_positions(case_id)
  WHERE deleted_at IS NULL AND exclusive IS TRUE;

-- Recria a view expondo a coluna nova (anexada ao fim).
CREATE OR REPLACE VIEW system_case_board_positions_active AS
  SELECT
    id, organization_id, case_id, board_id, stage_id, stage_slug,
    entered_at, created_at, updated_at, deleted_at,
    exclusive
  FROM system_case_board_positions
  WHERE deleted_at IS NULL;

GRANT SELECT ON system_case_board_positions_active TO anon, authenticated, service_role;
