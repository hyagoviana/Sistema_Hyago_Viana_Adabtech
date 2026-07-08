-- ============================================================================
-- Sistema HV — Autofill (Etapas B e C): tabelas de referência
-- ----------------------------------------------------------------------------
-- Reduz digitação na geração de documentos:
--   - system_municipios: dados do MUNICÍPIO (população, densidade, salário médio,
--     percentual, IBGE, secretário de saúde + cargo). Preenche 1x por cidade e é
--     reusado por todos os casos daquela cidade.
--   - system_perfis: PERFIL do Mais Médicos (nº do perfil → texto padrão).
-- Todos os valores são TEXT (inseridos verbatim no documento, preservando o
-- formato "11.451.245", "7.527,76", "31,6%"). Continuam EDITÁVEIS na geração.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Municípios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_municipios (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  nome              TEXT NOT NULL,          -- chave de busca, ex.: "São Paulo - SP"
  populacao         TEXT,                   -- ex.: "11.451.245"
  densidade         TEXT,                   -- ex.: "7.527,76"
  salario_medio     TEXT,                   -- ex.: "4,3"
  percentual        TEXT,                   -- ex.: "31,6%"
  ibge              TEXT,                   -- ex.: "355030"
  secretario_nome   TEXT,                   -- ex.: "Luiz Carlos Zamarco"
  secretario_cargo  TEXT,                   -- "Secretário" | "Secretária"

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- Busca por nome é case-insensitive; nome único por organização (não-excluídos).
CREATE UNIQUE INDEX IF NOT EXISTS system_municipios_nome_org_unique
  ON system_municipios (organization_id, lower(nome))
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_municipios_updated_at
  BEFORE UPDATE ON system_municipios
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_municipios_active AS
  SELECT * FROM system_municipios WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Perfis (Mais Médicos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_perfis (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  nome              TEXT NOT NULL,          -- ex.: "PERFIL 3"
  texto             TEXT,                   -- texto padrão vinculado ao perfil

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS system_perfis_nome_org_unique
  ON system_perfis (organization_id, lower(nome))
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_perfis_updated_at
  BEFORE UPDATE ON system_perfis
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_perfis_active AS
  SELECT * FROM system_perfis WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3) Auditoria + RLS + grants (padrão do sistema)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_municipios ON system_municipios;
CREATE TRIGGER trg_audit_municipios
  AFTER INSERT OR UPDATE OR DELETE ON system_municipios
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

DROP TRIGGER IF EXISTS trg_audit_perfis ON system_perfis;
CREATE TRIGGER trg_audit_perfis
  AFTER INSERT OR UPDATE OR DELETE ON system_perfis
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

ALTER TABLE system_municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_municipios_select_own_org ON system_municipios
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_municipios_insert_own_org ON system_municipios
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_municipios_update_own_org ON system_municipios
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_municipios_delete_own_org ON system_municipios
  FOR DELETE USING (organization_id = system_current_organization_id());

CREATE POLICY system_perfis_select_own_org ON system_perfis
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_perfis_insert_own_org ON system_perfis
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_perfis_update_own_org ON system_perfis
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_perfis_delete_own_org ON system_perfis
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_municipios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_municipios TO anon, authenticated;
GRANT SELECT ON system_municipios_active TO anon, authenticated, service_role;

GRANT ALL ON TABLE system_perfis TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_perfis TO anon, authenticated;
GRANT SELECT ON system_perfis_active TO anon, authenticated, service_role;
