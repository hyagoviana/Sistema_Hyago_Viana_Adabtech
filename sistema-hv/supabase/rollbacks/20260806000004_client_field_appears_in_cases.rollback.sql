-- ============================================================================
-- ROLLBACK — B1: Campo do CLIENTE espelhado no(s) CASO(s) (20260806000004)
-- ----------------------------------------------------------------------------
-- Remove a tabela de vínculo e a flag appears_in_cases. NÃO apaga dados de
-- valores do cliente (system_clients.custom_fields) nem as defs-espelho já
-- criadas em system_tema_field_defs (scope='cliente') — essas seguem sendo
-- geríveis pelo editor de tema. Idempotente.
-- ============================================================================

DROP VIEW IF EXISTS system_client_field_tema_links_active;
DROP TABLE IF EXISTS system_client_field_tema_links CASCADE;

ALTER TABLE system_client_field_defs
  DROP COLUMN IF EXISTS appears_in_cases;

CREATE OR REPLACE VIEW system_client_field_defs_active AS
  SELECT * FROM system_client_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_client_field_defs_active TO anon, authenticated, service_role;
