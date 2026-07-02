-- ============================================================================
-- Sistema HV — Migration — S4-03 — Bloco de notas livre (cliente e caso)
-- ----------------------------------------------------------------------------
-- Duas tabelas novas (modelagem B — FKs reais, RLS/índices simples):
--   - system_case_notes   (case_id   FK ON DELETE CASCADE)
--   - system_client_notes (client_id FK ON DELETE CASCADE)
--
-- DECISÃO (owner, v2.2): QUALQUER usuário autenticado lê/escreve notas — RLS só
-- isola por ORGANIZAÇÃO (sem gate por cargo). MANTIDOS: auditoria (created_by +
-- timestamps) e SOFT-DELETE (deleted_by/deleted_at, NUNCA hard-delete).
--
-- Molde: 20260703000001_stage_checklist.sql (RLS por org, grants nos 3 roles,
-- view _active WHERE deleted_at IS NULL, trigger updated_at, auditoria system_fn_audit).
--
-- REGRA DE OURO: esta migration NÃO toca colunas de system_cases → NÃO recria
-- system_cases_active. NÃO recriar trg_system_cases_bifurcacao (dropado).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Notas de CASO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_notes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id           UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,

  body              TEXT NOT NULL,

  created_by        UUID,                       -- ator (auditoria) — NOT NULL forçado no serviço
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID                        -- quem fez o soft-delete (trilha preservada)
);

-- Lookup por caso, mais recentes primeiro (só não-excluídos).
CREATE INDEX IF NOT EXISTS idx_system_case_notes_case_created
  ON system_case_notes (case_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_case_notes_updated_at
  BEFORE UPDATE ON system_case_notes
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_case_notes_active AS
  SELECT * FROM system_case_notes WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Notas de CLIENTE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_client_notes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  client_id         UUID NOT NULL REFERENCES system_clients(id) ON DELETE CASCADE,

  body              TEXT NOT NULL,

  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID
);

CREATE INDEX IF NOT EXISTS idx_system_client_notes_client_created
  ON system_client_notes (client_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_client_notes_updated_at
  BEFORE UPDATE ON system_client_notes
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_client_notes_active AS
  SELECT * FROM system_client_notes WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3) Auditoria + RLS + grants (padrão do sistema — molde stage_checklist)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_case_notes ON system_case_notes;
CREATE TRIGGER trg_audit_case_notes
  AFTER INSERT OR UPDATE OR DELETE ON system_case_notes
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

DROP TRIGGER IF EXISTS trg_audit_client_notes ON system_client_notes;
CREATE TRIGGER trg_audit_client_notes
  AFTER INSERT OR UPDATE OR DELETE ON system_client_notes
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

ALTER TABLE system_case_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_case_notes_select_own_org ON system_case_notes
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_case_notes_insert_own_org ON system_case_notes
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_notes_update_own_org ON system_case_notes
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_notes_delete_own_org ON system_case_notes
  FOR DELETE USING (organization_id = system_current_organization_id());

ALTER TABLE system_client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_client_notes_select_own_org ON system_client_notes
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_client_notes_insert_own_org ON system_client_notes
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_client_notes_update_own_org ON system_client_notes
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_client_notes_delete_own_org ON system_client_notes
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_case_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_notes TO anon, authenticated;
GRANT SELECT ON system_case_notes_active TO anon, authenticated, service_role;

GRANT ALL ON TABLE system_client_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_client_notes TO anon, authenticated;
GRANT SELECT ON system_client_notes_active TO anon, authenticated, service_role;
