-- ============================================================================
-- ROLLBACK — M9: peso do executor volta à base 1.0
-- ----------------------------------------------------------------------------
-- Simétrico ao 20260808000040. Reverte DEFAULT p/ 1.0 e divide os pesos por 100.
-- Guarda `weight > 10` = só os valores em base 100 (não toca já-1.0). Idempotente.
--
-- Aplicar via (de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/rollbacks/20260808000040_executor_weight_base100.rollback.sql
-- ============================================================================

ALTER TABLE system_projuris_executor_mapping
  ALTER COLUMN weight SET DEFAULT 1.0;

UPDATE system_projuris_executor_mapping
  SET weight = weight / 100
  WHERE weight > 10;
