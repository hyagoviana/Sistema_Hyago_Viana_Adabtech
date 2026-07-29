-- ============================================================================
-- Tabela de configuracao do Motor + extensao de executor_mapping
-- Story 4.2 + 4.5 — Epic 4
-- ============================================================================

-- Configuracao geral do Motor
CREATE TABLE IF NOT EXISTS system_distribution_config (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  mode             TEXT NOT NULL DEFAULT 'HIGH_PRODUCTION' CHECK (mode IN ('HIGH_PRODUCTION', 'HIGH_CONTROL')),
  batch_hour       INTEGER NOT NULL DEFAULT 6 CHECK (batch_hour BETWEEN 0 AND 23),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID REFERENCES system_users(id),
  CONSTRAINT uq_distribution_config_org UNIQUE (organization_id)
);

ALTER TABLE system_distribution_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY dist_config_select ON system_distribution_config FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY dist_config_upsert ON system_distribution_config FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_distribution_config TO authenticated;
GRANT ALL ON system_distribution_config TO service_role;

-- Seed config default
INSERT INTO system_distribution_config (organization_id, mode, batch_hour)
VALUES ('00000000-0000-0000-0000-000000000001', 'HIGH_PRODUCTION', 6)
ON CONFLICT (organization_id) DO NOTHING;

-- Extensao de projuris_executor_mapping com campos de config do Motor (Story 4.2)
ALTER TABLE system_projuris_executor_mapping
  ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS eligible_complex BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS authorized_task_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS authorized_themes TEXT[] NOT NULL DEFAULT '{}';

-- Descricao nos mapeamentos (Story 4.3, 4.4)
ALTER TABLE system_task_type_mapping
  ADD COLUMN IF NOT EXISTS projuris_tipo_descricao TEXT;

ALTER TABLE system_theme_mapping
  ADD COLUMN IF NOT EXISTS projuris_tema_descricao TEXT;
