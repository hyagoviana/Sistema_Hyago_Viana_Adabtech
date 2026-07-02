-- ============================================================================
-- Sistema HV — Migration — S2-01 — Checklist por etapa (def + instância)
-- ----------------------------------------------------------------------------
-- Fundação da Sprint 2 (Onboard por subetapas). Duas tabelas novas:
--   - system_stage_checklist_defs: definição de itens de checklist por
--     (service_type_id + stage_slug). Ancorada em stage_slug (NUNCA stage_id),
--     pois etapas revivem por slug via ON CONFLICT (service_type_id, kind, slug).
--   - system_case_checklist_items: instância dos itens por (case_id + def).
--
-- Molde: 20260622000002_client_custom_fields.sql (RLS por org, grants, view _active,
-- updated_at trigger, auditoria). Padrão de UNIQUE parcial WHERE deleted_at IS NULL.
--
-- REGRA DE OURO: esta migration NÃO toca colunas de system_cases → NÃO recria
-- system_cases_active. NÃO recriar trg_system_cases_bifurcacao (dropado).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Definições de checklist por etapa (por service_type_id + stage_slug)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_stage_checklist_defs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  service_type_id       UUID NOT NULL REFERENCES system_service_types(id) ON DELETE CASCADE,

  stage_slug            TEXT NOT NULL,          -- chave de ancoragem (sem FK p/ stage_id)
  key                   TEXT NOT NULL,          -- slug estável do item dentro da etapa
  label                 TEXT NOT NULL,          -- rótulo exibido
  ordem                 INTEGER NOT NULL DEFAULT 0,
  required              BOOLEAN NOT NULL DEFAULT FALSE,
  expected_doc_pattern  TEXT,                   -- opcional (consumido por S2-06; nullable)
  active                BOOLEAN NOT NULL DEFAULT TRUE,

  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- Impede def duplicada por (tipo, etapa, key) entre os não-excluídos.
CREATE UNIQUE INDEX IF NOT EXISTS system_stage_checklist_defs_uq
  ON system_stage_checklist_defs (service_type_id, stage_slug, key)
  WHERE deleted_at IS NULL;

-- Lookup por etapa (ordenado).
CREATE INDEX IF NOT EXISTS idx_system_stage_checklist_defs_lookup
  ON system_stage_checklist_defs (service_type_id, stage_slug, ordem)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_stage_checklist_defs_updated_at
  BEFORE UPDATE ON system_stage_checklist_defs
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_stage_checklist_defs_active AS
  SELECT * FROM system_stage_checklist_defs WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Instâncias de checklist por caso (por case_id + def)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_checklist_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id           UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  def_id            UUID NOT NULL REFERENCES system_stage_checklist_defs(id),

  stage_slug        TEXT NOT NULL,          -- redundante p/ query por etapa sem join
  done              BOOLEAN NOT NULL DEFAULT FALSE,
  done_at           TIMESTAMPTZ,
  done_by           UUID,
  source            TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'drive_suggest')),
  drive_file_id     TEXT,                   -- dedupe do auto-check (S2-06)

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- Impede item duplicado por caso (idempotência da instanciação — S2-03).
CREATE UNIQUE INDEX IF NOT EXISTS system_case_checklist_items_uq
  ON system_case_checklist_items (case_id, def_id)
  WHERE deleted_at IS NULL;

-- Lookup por caso + etapa (usado pelo gate S2-04).
CREATE INDEX IF NOT EXISTS idx_system_case_checklist_items_case_stage
  ON system_case_checklist_items (case_id, stage_slug)
  WHERE deleted_at IS NULL;

-- Dedupe do auto-check por drive_file_id (S2-06).
CREATE INDEX IF NOT EXISTS idx_system_case_checklist_items_drive_file
  ON system_case_checklist_items (drive_file_id)
  WHERE drive_file_id IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_system_case_checklist_items_updated_at
  BEFORE UPDATE ON system_case_checklist_items
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_case_checklist_items_active AS
  SELECT * FROM system_case_checklist_items WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3) Auditoria + RLS + grants (padrão do sistema — molde client_custom_fields)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_stage_checklist_defs ON system_stage_checklist_defs;
CREATE TRIGGER trg_audit_stage_checklist_defs
  AFTER INSERT OR UPDATE OR DELETE ON system_stage_checklist_defs
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

DROP TRIGGER IF EXISTS trg_audit_case_checklist_items ON system_case_checklist_items;
CREATE TRIGGER trg_audit_case_checklist_items
  AFTER INSERT OR UPDATE OR DELETE ON system_case_checklist_items
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

ALTER TABLE system_stage_checklist_defs ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_stage_checklist_defs_select_own_org ON system_stage_checklist_defs
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_stage_checklist_defs_insert_own_org ON system_stage_checklist_defs
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_stage_checklist_defs_update_own_org ON system_stage_checklist_defs
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_stage_checklist_defs_delete_own_org ON system_stage_checklist_defs
  FOR DELETE USING (organization_id = system_current_organization_id());

ALTER TABLE system_case_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_case_checklist_items_select_own_org ON system_case_checklist_items
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_case_checklist_items_insert_own_org ON system_case_checklist_items
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_checklist_items_update_own_org ON system_case_checklist_items
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_checklist_items_delete_own_org ON system_case_checklist_items
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_stage_checklist_defs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_stage_checklist_defs TO anon, authenticated;
GRANT SELECT ON system_stage_checklist_defs_active TO anon, authenticated, service_role;

GRANT ALL ON TABLE system_case_checklist_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_checklist_items TO anon, authenticated;
GRANT SELECT ON system_case_checklist_items_active TO anon, authenticated, service_role;
