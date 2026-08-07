-- ============================================================================
-- Sistema HV — Migration — B1: Campo do CLIENTE espelhado no(s) CASO(s)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-05 (Story B1, inclui B2). ADITIVA/idempotente.
--
-- OBJETIVO: um campo personalizado do CLIENTE pode "aparecer nos casos" e ser
-- vinculado a N temas. A FONTE do dado é ÚNICA (system_clients.custom_fields[key]);
-- em cada tema vinculado o backend reconcilia uma DEF-ESPELHO em
-- system_tema_field_defs (scope='cliente', mesma key/label) — que já lê/grava no
-- balde único do cliente (bifurcação: um comando vem de dois lugares — cadastro
-- do cliente E ficha do caso — e reflete em todos os temas vinculados).
--
-- DECISÕES DE MODELO (registradas no Change Log da story):
--   D1 = D1-A: tabela de vínculo N:N `system_client_field_tema_links` +
--        `appears_in_cases BOOLEAN` (flag de conveniência no campo do cliente).
--   D2 = vínculo é MESTRE: a def-espelho de tema é DERIVADA e reconciliada por
--        `reconcileClientFieldTemaLinks` (idempotente); nunca apaga dado do cliente.
--
-- REGRESSÃO ZERO: a coluna nova nasce FALSE (nenhum campo existente muda de
-- comportamento; zero vínculos ⇒ zero defs-espelho). A view _active é apenas
-- recriada (SELECT *). Nenhuma tabela existente de valores é tocada.
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260806000004_client_field_appears_in_cases.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) (B2) Flag "aparece em caso" no campo do cliente
-- ----------------------------------------------------------------------------
ALTER TABLE system_client_field_defs
  ADD COLUMN IF NOT EXISTS appears_in_cases BOOLEAN NOT NULL DEFAULT FALSE;

-- View _active recriada (SELECT * pega a coluna nova automaticamente).
CREATE OR REPLACE VIEW system_client_field_defs_active AS
  SELECT * FROM system_client_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_client_field_defs_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) Vínculo N:N campo-do-cliente → tema (D1-A)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_client_field_tema_links (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  client_field_def_id   UUID NOT NULL REFERENCES system_client_field_defs(id) ON DELETE CASCADE,
  tema_id               UUID NOT NULL REFERENCES system_temas(id) ON DELETE CASCADE,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- Um vínculo por (campo do cliente, tema) entre os não-excluídos — soft-delete
-- libera o par para re-vincular sem duplicar (idempotência do reconcile).
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_client_field_tema_links
  ON system_client_field_tema_links (client_field_def_id, tema_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_client_field_tema_links_field
  ON system_client_field_tema_links (client_field_def_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_client_field_tema_links_tema
  ON system_client_field_tema_links (tema_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_client_field_tema_links_updated_at ON system_client_field_tema_links;
CREATE TRIGGER trg_system_client_field_tema_links_updated_at
  BEFORE UPDATE ON system_client_field_tema_links
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_client_field_tema_links_active AS
  SELECT * FROM system_client_field_tema_links WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3) RLS + Grants (por org — molde 20260622000002 / 20260804000004)
-- ----------------------------------------------------------------------------
ALTER TABLE system_client_field_tema_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_client_field_tema_links_select ON system_client_field_tema_links;
DROP POLICY IF EXISTS system_client_field_tema_links_insert ON system_client_field_tema_links;
DROP POLICY IF EXISTS system_client_field_tema_links_update ON system_client_field_tema_links;
DROP POLICY IF EXISTS system_client_field_tema_links_delete ON system_client_field_tema_links;
CREATE POLICY system_client_field_tema_links_select ON system_client_field_tema_links
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_client_field_tema_links_insert ON system_client_field_tema_links
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_client_field_tema_links_update ON system_client_field_tema_links
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_client_field_tema_links_delete ON system_client_field_tema_links
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_client_field_tema_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_client_field_tema_links TO anon, authenticated;
GRANT SELECT ON system_client_field_tema_links_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) Auditoria (padrão do sistema)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_client_field_tema_links ON system_client_field_tema_links;
CREATE TRIGGER trg_audit_client_field_tema_links
  AFTER INSERT OR UPDATE OR DELETE ON system_client_field_tema_links
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();
