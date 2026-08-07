-- ============================================================================
-- ROLLBACK — H2: tabela satelite de aprovacao da distribuicao
-- Reverte 20260805000004_distribution_approvals.sql
-- ============================================================================
DROP TABLE IF EXISTS system_distribution_approvals CASCADE;
DROP TYPE IF EXISTS distribution_approval_status;
