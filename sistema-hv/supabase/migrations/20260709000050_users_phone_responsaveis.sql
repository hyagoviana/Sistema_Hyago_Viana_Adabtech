-- ============================================================================
-- Sistema HV — Migration — Telefone do usuário + Responsáveis por caso (item 2)
-- ----------------------------------------------------------------------------
-- Pedido do owner (2026-07-09):
--   • usuário do sistema passa a ter TELEFONE (editável por ele ou pelo admin);
--   • o "Responsável" do caso deixa de ser texto e vira VÍNCULO N:N com usuários
--     (advogados titulares/associados). Base para "advogado só vê os casos dele".
--
-- Mantemos system_cases.responsavel (TEXT) como cache de EXIBIÇÃO (nomes juntos),
-- para as várias telas que já mostram o responsável sem quebrar. A fonte de
-- verdade do VÍNCULO (e da visibilidade) é system_case_responsaveis.
-- Idempotente.
-- ============================================================================

-- 1) Telefone no usuário.
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;
GRANT SELECT ON system_users_active TO anon, authenticated, service_role;

-- 2) Responsáveis por caso (N:N com system_users).
CREATE TABLE IF NOT EXISTS system_case_responsaveis (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id          UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE (case_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_case_responsaveis_user
  ON system_case_responsaveis(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_case_responsaveis_case
  ON system_case_responsaveis(case_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW system_case_responsaveis_active AS
  SELECT id, organization_id, case_id, user_id, created_by, created_at, deleted_at
  FROM system_case_responsaveis WHERE deleted_at IS NULL;

GRANT ALL ON TABLE system_case_responsaveis TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_responsaveis TO anon, authenticated;
GRANT SELECT ON system_case_responsaveis_active TO anon, authenticated, service_role;
