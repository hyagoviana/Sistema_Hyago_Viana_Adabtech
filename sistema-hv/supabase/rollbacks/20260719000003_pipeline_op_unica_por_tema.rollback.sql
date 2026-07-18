-- ============================================================================
-- Rollback — R2-03 — Pipeline op única por TEMA (aditiva — só coluna)
-- ----------------------------------------------------------------------------
-- Desfaz a migration 20260719000003: dropa a coluna aditiva de exibição.
-- Como a migration é estritamente aditiva (só a coluna frente_slug, sem backfill
-- nem consolidação), o rollback é apenas o DROP COLUMN — simétrico e idempotente.
-- NÃO toca system_cases / view / triggers / funções de auto-avanço.
-- ============================================================================

ALTER TABLE system_pipeline_stages DROP COLUMN IF EXISTS frente_slug;
