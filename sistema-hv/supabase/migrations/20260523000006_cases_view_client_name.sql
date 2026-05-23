-- ============================================================================
-- Sistema HV — Migration 0006 — system_cases_active inclui client_name
-- ----------------------------------------------------------------------------
-- Evita o app ter que fazer JOIN manual pra exibir o nome do cliente no Kanban
-- e na Lista.
-- ============================================================================

CREATE OR REPLACE VIEW system_cases_active AS
  SELECT
    c.*,
    cli.full_name AS client_name,
    cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
