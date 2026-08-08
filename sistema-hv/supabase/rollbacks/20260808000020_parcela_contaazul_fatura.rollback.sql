-- ============================================================================
-- ROLLBACK — M6: Nº da fatura do Conta Azul por cobrança/parcela
-- ----------------------------------------------------------------------------
-- Simétrico ao 20260808000020_parcela_contaazul_fatura.sql. Idempotente.
--
-- A view system_parcelas_active (SELECT *) passa a depender da coluna nova após
-- o CREATE OR REPLACE da migration; por isso DROP a view ANTES de dropar a
-- coluna, e recrio a view (reexpandindo o * sem a coluna).
--
-- Aplicar via (de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/rollbacks/20260808000020_parcela_contaazul_fatura.rollback.sql
-- ============================================================================

DROP VIEW IF EXISTS system_parcelas_active;

ALTER TABLE system_parcelas
  DROP COLUMN IF EXISTS contaazul_fatura_numero;

CREATE OR REPLACE VIEW system_parcelas_active AS
  SELECT * FROM system_parcelas;

GRANT SELECT ON system_parcelas_active TO anon, authenticated, service_role;
