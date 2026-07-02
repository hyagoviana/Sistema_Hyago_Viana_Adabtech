-- ============================================================================
-- ROLLBACK — Migration 0030 (S1-01: ciclo de vida do caso)
-- ----------------------------------------------------------------------------
-- Remove as invariantes, o índice e as colunas lifecycle/perdido_at/perdido_motivo,
-- e refaz a view sem as colunas novas (mantendo grants). NÃO recria o trigger de
-- bifurcação (segue dropado desde a 0022).
-- ============================================================================

DROP VIEW IF EXISTS system_cases_active;

ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_assinatura_lifecycle_chk;
ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_perdido_lifecycle_chk;
ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_lifecycle_domain_chk;

DROP INDEX IF EXISTS idx_system_cases_lifecycle;

ALTER TABLE system_cases
  DROP COLUMN IF EXISTS perdido_motivo,
  DROP COLUMN IF EXISTS perdido_at,
  DROP COLUMN IF EXISTS lifecycle;

CREATE VIEW system_cases_active AS
  SELECT c.*, cli.full_name AS client_name, cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
