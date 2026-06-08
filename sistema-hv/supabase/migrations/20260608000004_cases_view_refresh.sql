-- ============================================================================
-- Sistema HV — Migration 0016 — Refresh da view system_cases_active
-- ----------------------------------------------------------------------------
-- A view foi criada com SELECT c.* antes das colunas novas (drive_*, service_type_id,
-- stage_op_id, stage_fin_id). DROP+CREATE pra expô-las ao app (a S14 precisa delas).
-- ============================================================================

DROP VIEW IF EXISTS system_cases_active;

CREATE VIEW system_cases_active AS
  SELECT
    c.*,
    cli.full_name AS client_name,
    cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
