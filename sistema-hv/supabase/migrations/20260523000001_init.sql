-- ============================================================================
-- Sistema HV — Migration 0001 — Schema inicial (MVP-Drive)
-- ----------------------------------------------------------------------------
-- CONVENÇÃO: todas as tabelas/views/funcs/triggers/policies do sistema HV
-- usam o prefixo `system_` para distinguir das tabelas legadas do projeto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper trigger: updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Tabela: system_organizations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  cnpj          TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed org default (MVP single-tenant)
INSERT INTO system_organizations (id, name, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'Hyago Viana Advocacia', NULL)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Tabela: system_clients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  -- Dados cadastrais
  full_name           TEXT NOT NULL,
  cpf_cnpj            TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  address             JSONB,

  -- Integração Google Drive
  drive_folder_id     TEXT,
  drive_folder_url    TEXT,
  drive_sync_failed   BOOLEAN NOT NULL DEFAULT FALSE,
  drive_sync_error    VARCHAR(2000),

  -- Auditoria + soft-delete
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- UNIQUE partial: CPF/CNPJ único por org SOMENTE para clientes ativos.
-- Permite re-cadastrar um CPF após soft-delete (LGPD-friendly).
CREATE UNIQUE INDEX IF NOT EXISTS system_clients_cpf_cnpj_org_active_unique
  ON system_clients (organization_id, cpf_cnpj)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_clients_org_active
  ON system_clients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_clients_full_name_trgm
  ON system_clients USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_system_clients_cpf_cnpj
  ON system_clients(cpf_cnpj);

CREATE TRIGGER trg_system_clients_updated_at
  BEFORE UPDATE ON system_clients
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_clients_active AS
  SELECT * FROM system_clients WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Tabela: system_client_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_client_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES system_clients(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  name            TEXT NOT NULL,
  description     TEXT,

  -- Google Drive
  drive_file_id   TEXT NOT NULL,
  drive_url       TEXT NOT NULL,

  -- Metadado de arquivo
  mime_type       TEXT,
  size_bytes      BIGINT,
  sha256          TEXT,

  -- Auditoria + soft-delete
  uploaded_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_client_documents_client
  ON system_client_documents(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_client_documents_org
  ON system_client_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_client_documents_drive_file
  ON system_client_documents(drive_file_id);

CREATE TRIGGER trg_system_client_documents_updated_at
  BEFORE UPDATE ON system_client_documents
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_client_documents_active AS
  SELECT * FROM system_client_documents WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Tabela: system_audit_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES system_organizations(id) ON DELETE RESTRICT,
  actor_id        UUID,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  diff            JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_log_org_created
  ON system_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_entity
  ON system_audit_log(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Helper: extrair organization_id do JWT (com fallback MVP)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_current_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id', '')::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '00000000-0000-0000-0000-000000000001'::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- RLS — system_clients
-- ----------------------------------------------------------------------------
ALTER TABLE system_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_clients_select_own_org ON system_clients
  FOR SELECT USING (organization_id = system_current_organization_id());

CREATE POLICY system_clients_insert_own_org ON system_clients
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_clients_update_own_org ON system_clients
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_clients_delete_own_org ON system_clients
  FOR DELETE USING (organization_id = system_current_organization_id());

-- ----------------------------------------------------------------------------
-- RLS — system_client_documents
-- ----------------------------------------------------------------------------
ALTER TABLE system_client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_client_documents_select_own_org ON system_client_documents
  FOR SELECT USING (organization_id = system_current_organization_id());

CREATE POLICY system_client_documents_insert_own_org ON system_client_documents
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_client_documents_update_own_org ON system_client_documents
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_client_documents_delete_own_org ON system_client_documents
  FOR DELETE USING (organization_id = system_current_organization_id());

-- ----------------------------------------------------------------------------
-- RLS — system_audit_log (somente leitura para usuários da mesma org)
-- ----------------------------------------------------------------------------
ALTER TABLE system_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_audit_log_select_own_org ON system_audit_log
  FOR SELECT USING (organization_id = system_current_organization_id());
-- INSERT em system_audit_log fica via service_role (backend), sem policy explícita.
