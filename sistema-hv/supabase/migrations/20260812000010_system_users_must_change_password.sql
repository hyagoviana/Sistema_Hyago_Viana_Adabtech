-- ============================================================================
-- Sistema HV — Migration — Senha provisória + troca obrigatória no 1º login
-- ----------------------------------------------------------------------------
-- Pedido do owner (2026-08-12, alinhado com Thiago): os colaboradores entram
-- HOJE em massa com uma senha PROVISÓRIA padrão e são OBRIGADOS a definir uma
-- senha nova no primeiro acesso, antes de usar o sistema.
--
-- `must_change_password` = true bloqueia o app e força o desvio para /nova-senha
-- (guard no RootLayout). Ao definir a senha nova, o app zera a flag.
--
-- Nasce DEFAULT false → usuários existentes (e o fluxo de convite por e-mail)
-- não regridem. ADITIVA/idempotente.
--
-- Aplicar via (de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260812000010_system_users_must_change_password.sql
-- ============================================================================

ALTER TABLE system_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN system_users.must_change_password IS
  'Se true, o usuário é forçado a definir uma senha nova no próximo login (senha provisória). O app zera ao concluir a troca.';

-- GOTCHA SELECT *: a view system_users_active é `SELECT *` (Postgres CONGELA as
-- colunas na criação da view). Reexpande p/ incluir a coluna nova — senão o
-- perfil (auth.tsx) e listUsers, que leem da view, não enxergam a flag.
-- Ver 20260808000030 / 20260808000050 (mesmo fix).
CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;
GRANT SELECT ON system_users_active TO anon, authenticated, service_role;
