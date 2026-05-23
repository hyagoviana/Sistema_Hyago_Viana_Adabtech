-- ============================================================================
-- Sistema HV — Migration 0001 — Schema inicial (MVP-Drive)
-- ----------------------------------------------------------------------------
-- Tabelas: organizations, clients, client_documents, audit_log
-- RLS organization-scoped via current_organization_id() (JWT claim + fallback)
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
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Tabela: organizations (preparada pra multi-tenancy)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  cnpj          TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed org default (MVP single-tenant)
INSERT INTO organizations (id, name, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'Hyago Viana Advocacia', NULL)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Tabela: clients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

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
CREATE UNIQUE INDEX IF NOT EXISTS clients_cpf_cnpj_org_active_unique
  ON clients (organization_id, cpf_cnpj)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_org_active
  ON clients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_full_name_trgm
  ON clients USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_cpf_cnpj ON clients(cpf_cnpj);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE VIEW clients_active AS
  SELECT * FROM clients WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Tabela: client_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

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

CREATE INDEX IF NOT EXISTS idx_client_documents_client
  ON client_documents(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_documents_org
  ON client_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_documents_drive_file
  ON client_documents(drive_file_id);

CREATE TRIGGER trg_client_documents_updated_at
  BEFORE UPDATE ON client_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE VIEW client_documents_active AS
  SELECT * FROM client_documents WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Tabela: audit_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_id        UUID,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  diff            JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Helper: extrair organization_id do JWT (com fallback MVP)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_organization_id()
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
-- RLS — clients
-- ----------------------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select_own_org ON clients
  FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY clients_insert_own_org ON clients
  FOR INSERT WITH CHECK (organization_id = current_organization_id());

CREATE POLICY clients_update_own_org ON clients
  FOR UPDATE USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY clients_delete_own_org ON clients
  FOR DELETE USING (organization_id = current_organization_id());

-- ----------------------------------------------------------------------------
-- RLS — client_documents
-- ----------------------------------------------------------------------------
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_documents_select_own_org ON client_documents
  FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY client_documents_insert_own_org ON client_documents
  FOR INSERT WITH CHECK (organization_id = current_organization_id());

CREATE POLICY client_documents_update_own_org ON client_documents
  FOR UPDATE USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY client_documents_delete_own_org ON client_documents
  FOR DELETE USING (organization_id = current_organization_id());

-- ----------------------------------------------------------------------------
-- RLS — audit_log (somente leitura para usuários da mesma org)
-- ----------------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_own_org ON audit_log
  FOR SELECT USING (organization_id = current_organization_id());
-- INSERT em audit_log fica via service_role (backend), sem policy explícita.
