-- ============================================================================
-- Sistema HV — Rollback da Migration 0001
-- ----------------------------------------------------------------------------
-- ATENÇÃO: roda DROP em ordem inversa às dependências (FKs).
-- Idempotente: usa IF EXISTS em tudo.
-- Não rode em produção sem backup.
-- ============================================================================

-- Policies primeiro (pra evitar warnings ao remover tabelas com RLS)
DROP POLICY IF EXISTS audit_log_select_own_org ON audit_log;

DROP POLICY IF EXISTS client_documents_select_own_org ON client_documents;
DROP POLICY IF EXISTS client_documents_insert_own_org ON client_documents;
DROP POLICY IF EXISTS client_documents_update_own_org ON client_documents;
DROP POLICY IF EXISTS client_documents_delete_own_org ON client_documents;

DROP POLICY IF EXISTS clients_select_own_org ON clients;
DROP POLICY IF EXISTS clients_insert_own_org ON clients;
DROP POLICY IF EXISTS clients_update_own_org ON clients;
DROP POLICY IF EXISTS clients_delete_own_org ON clients;

-- Views
DROP VIEW IF EXISTS client_documents_active;
DROP VIEW IF EXISTS clients_active;

-- Tabelas em ordem inversa (filhas → pais)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS client_documents CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Funções helper
DROP FUNCTION IF EXISTS current_organization_id();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Extensions ficam (são compartilhadas com outros schemas potencialmente).
