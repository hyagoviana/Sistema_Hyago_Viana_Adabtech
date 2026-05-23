-- ============================================================================
-- Sistema HV — Migration 0002 — Grants para roles do Supabase
-- ----------------------------------------------------------------------------
-- Por padrão, tabelas criadas via migration têm como owner o role postgres
-- e nenhum outro role tem acesso. Aqui concedemos GRANT explícito para os
-- roles do PostgREST (anon, authenticated, service_role) nas tabelas do
-- sistema HV — RLS continua sendo o gate de segurança real.
-- ============================================================================

-- service_role: bypassa RLS, precisa de acesso total
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE system_organizations,
                  system_clients,
                  system_client_documents,
                  system_audit_log
  TO service_role;
GRANT EXECUTE ON FUNCTION system_current_organization_id(),
                          system_update_updated_at_column()
  TO service_role;

-- anon + authenticated: passam pela RLS — sem RLS habilitada, INSERT/SELECT
-- ainda precisam de GRANT. Damos acesso e RLS faz o filtro.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_clients,
                                              system_client_documents
  TO anon, authenticated;
GRANT SELECT ON TABLE system_organizations, system_audit_log TO anon, authenticated;
GRANT SELECT ON system_clients_active, system_client_documents_active
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION system_current_organization_id() TO anon, authenticated;
