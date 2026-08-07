-- ============================================================================
-- Sistema HV — Migration — G4: Caso SIGILOSO + usuários autorizados (Judicial)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-05 (Story G4). ADITIVA/idempotente.
--
-- OBJETIVO: marcar um caso como "sigiloso" e listar os usuários AUTORIZADOS a
-- ver o submenu Judicial desse caso. Regra: todos veem o Judicial EXCETO em
-- caso sigiloso (só admin + autorizados). O gate real é no servidor
-- (isAutorizadoJudicial); esta migration é só o modelo de dados.
--
--   D-G4: criador (created_by) e responsável do caso entram como autorizados por
--         padrão NA REGRA (não persistidos aqui) — evita auto-trancamento. A
--         tabela guarda só os autorizados adicionados manualmente.
--
-- REGRESSÃO ZERO: `sigiloso` nasce FALSE (todos os casos existentes = visíveis
-- a todos). Tabela nova vazia. RLS org-scoped.
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260806000007_case_sigiloso.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Flag sigiloso no caso
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS sigiloso BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 2) Usuários autorizados por caso sigiloso (N:N)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_sigilo_users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id           UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_case_sigilo_users
  ON system_case_sigilo_users (case_id, user_id);
CREATE INDEX IF NOT EXISTS idx_system_case_sigilo_users_case
  ON system_case_sigilo_users (case_id);
CREATE INDEX IF NOT EXISTS idx_system_case_sigilo_users_user
  ON system_case_sigilo_users (user_id);

-- ----------------------------------------------------------------------------
-- 3) RLS + Grants (por org — molde 20260806000004 / system_case_responsaveis)
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_sigilo_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_case_sigilo_users_select ON system_case_sigilo_users;
DROP POLICY IF EXISTS system_case_sigilo_users_insert ON system_case_sigilo_users;
DROP POLICY IF EXISTS system_case_sigilo_users_update ON system_case_sigilo_users;
DROP POLICY IF EXISTS system_case_sigilo_users_delete ON system_case_sigilo_users;
CREATE POLICY system_case_sigilo_users_select ON system_case_sigilo_users
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_case_sigilo_users_insert ON system_case_sigilo_users
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_sigilo_users_update ON system_case_sigilo_users
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_sigilo_users_delete ON system_case_sigilo_users
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_case_sigilo_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_sigilo_users TO anon, authenticated;
