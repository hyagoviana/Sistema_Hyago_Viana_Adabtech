-- ============================================================================
-- Sistema HV — Migration 0011 — RBAC (papéis) + LGPD (consentimento) [Fila item 1]
-- ----------------------------------------------------------------------------
-- MVP pragmático: 1 papel por usuário em system_users (espelha auth.users).
-- Escala para multi-papel/permissões-JSON do PRD quando necessário.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- system_users — perfil do usuário do sistema (1:1 com auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_users (
  id              UUID PRIMARY KEY,  -- = auth.users.id
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  email           TEXT NOT NULL,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'operacional'
                    CHECK (role IN ('admin','advogado_titular','advogado_associado',
                                    'prestador_externo','controladoria','comercial',
                                    'financeiro','operacional','marketing')),
  status          TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('INVITED','ACTIVE','SUSPENDED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_users_org
  ON system_users(organization_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS system_users_email_active_unique
  ON system_users(organization_id, email) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_users_updated_at
  BEFORE UPDATE ON system_users
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;

-- Papel do usuário logado (usado em RLS e na UI)
CREATE OR REPLACE FUNCTION system_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM system_users
  WHERE id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ----------------------------------------------------------------------------
-- system_consent_records — consentimento LGPD
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_consent_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  client_id       UUID REFERENCES system_clients(id) ON DELETE SET NULL,
  cpf_cnpj        TEXT,
  finalidade      TEXT NOT NULL,                 -- ex.: 'prestacao_servico_juridico'
  policy_version  TEXT NOT NULL DEFAULT '1.0.0',
  channel         TEXT CHECK (channel IS NULL OR channel IN
                    ('WHATSAPP','PORTAL','PRESENCIAL','EMAIL','SISTEMA')),
  ip_address      INET,
  user_agent      TEXT,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  revoke_reason   TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_consent_client
  ON system_consent_records(client_id);
CREATE INDEX IF NOT EXISTS idx_system_consent_cpf
  ON system_consent_records(cpf_cnpj);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_users_select_own_org ON system_users
  FOR SELECT USING (organization_id = system_current_organization_id());
-- INSERT/UPDATE/DELETE de usuários ficam via service_role (backend valida que ator é admin).

ALTER TABLE system_consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_consent_select_own_org ON system_consent_records
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_consent_insert_own_org ON system_consent_records
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

-- ----------------------------------------------------------------------------
-- Grants (sem isto o PostgREST/app retorna 500)
-- ----------------------------------------------------------------------------
GRANT ALL ON TABLE system_users, system_consent_records TO service_role;
GRANT SELECT ON TABLE system_users, system_consent_records TO authenticated, anon;
GRANT INSERT ON TABLE system_consent_records TO authenticated;
GRANT SELECT ON system_users_active TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION system_current_user_role() TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- Seed: o super admin existente vira role 'admin'
-- ----------------------------------------------------------------------------
INSERT INTO system_users (id, organization_id, email, full_name, role, status)
SELECT u.id, '00000000-0000-0000-0000-000000000001', u.email, 'Hyago Viana', 'admin', 'ACTIVE'
FROM auth.users u
WHERE u.email = 'hyagoviana.adv@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'ACTIVE';
