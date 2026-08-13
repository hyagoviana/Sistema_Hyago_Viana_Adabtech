-- ============================================================================
-- Transformador de Importacao — Schema
-- Permite importar clientes/casos a partir de planilhas externas (SAJ, PJe, etc.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Templates de mapeamento reutilizaveis
-- ----------------------------------------------------------------------------
CREATE TABLE system_import_mapping_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
                  REFERENCES system_organizations(id) ON DELETE RESTRICT,

  name            TEXT NOT NULL,                -- ex.: "Exportacao SAJ - Clientes"
  source_system   TEXT,                         -- ex.: "SAJ", "PJe", "Projuris", "Outro"
  target_entity   TEXT NOT NULL CHECK (target_entity IN ('client', 'case', 'client+case')),

  -- Array de { sourceColumn, targetField, transform? }
  column_mappings JSONB NOT NULL DEFAULT '[]',

  -- Configuracoes extras: encoding, delimiter, skip_rows, etc.
  settings        JSONB DEFAULT '{}',

  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- RLS
ALTER TABLE system_import_mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_import_templates" ON system_import_mapping_templates
  FOR SELECT USING (organization_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "org_write_import_templates" ON system_import_mapping_templates
  FOR ALL USING (organization_id = '00000000-0000-0000-0000-000000000001');

GRANT ALL ON system_import_mapping_templates TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Historico de execucoes de importacao
-- ----------------------------------------------------------------------------
CREATE TABLE system_import_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
                  REFERENCES system_organizations(id) ON DELETE RESTRICT,

  template_id     UUID REFERENCES system_import_mapping_templates(id),
  file_name       TEXT NOT NULL,
  file_size_bytes INTEGER,

  total_rows      INTEGER NOT NULL DEFAULT 0,
  imported_rows   INTEGER NOT NULL DEFAULT 0,
  skipped_rows    INTEGER NOT NULL DEFAULT 0,
  error_rows      INTEGER NOT NULL DEFAULT 0,
  errors          JSONB DEFAULT '[]',       -- array de { row, field, message }

  status          TEXT NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('completed', 'partial', 'failed')),
  target_entity   TEXT NOT NULL CHECK (target_entity IN ('client', 'case', 'client+case')),

  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE system_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_import_runs" ON system_import_runs
  FOR SELECT USING (organization_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "org_write_import_runs" ON system_import_runs
  FOR ALL USING (organization_id = '00000000-0000-0000-0000-000000000001');

GRANT ALL ON system_import_runs TO authenticated, service_role;

-- Indice para listar historico recente
CREATE INDEX idx_import_runs_created ON system_import_runs (organization_id, created_at DESC);
