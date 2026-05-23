-- ============================================================================
-- Sistema HV — Rollback da Migration 0001
-- ----------------------------------------------------------------------------
-- ATENÇÃO: roda DROP em ordem inversa às dependências (FKs).
-- Idempotente: usa IF EXISTS em tudo.
-- Não rode em produção sem backup.
-- ============================================================================

-- Policies primeiro (pra evitar warnings ao remover tabelas com RLS)
DROP POLICY IF EXISTS system_audit_log_select_own_org ON system_audit_log;

DROP POLICY IF EXISTS system_client_documents_select_own_org ON system_client_documents;
DROP POLICY IF EXISTS system_client_documents_insert_own_org ON system_client_documents;
DROP POLICY IF EXISTS system_client_documents_update_own_org ON system_client_documents;
DROP POLICY IF EXISTS system_client_documents_delete_own_org ON system_client_documents;

DROP POLICY IF EXISTS system_clients_select_own_org ON system_clients;
DROP POLICY IF EXISTS system_clients_insert_own_org ON system_clients;
DROP POLICY IF EXISTS system_clients_update_own_org ON system_clients;
DROP POLICY IF EXISTS system_clients_delete_own_org ON system_clients;

-- Views
DROP VIEW IF EXISTS system_client_documents_active;
DROP VIEW IF EXISTS system_clients_active;

-- Tabelas em ordem inversa (filhas → pais)
DROP TABLE IF EXISTS system_audit_log CASCADE;
DROP TABLE IF EXISTS system_client_documents CASCADE;
DROP TABLE IF EXISTS system_clients CASCADE;
DROP TABLE IF EXISTS system_organizations CASCADE;

-- Funções helper
DROP FUNCTION IF EXISTS system_current_organization_id();
DROP FUNCTION IF EXISTS system_update_updated_at_column();

-- Extensions ficam (são compartilhadas com outros schemas potencialmente).
