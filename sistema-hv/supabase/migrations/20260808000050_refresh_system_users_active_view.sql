-- ============================================================================
-- Sistema HV — FIX M8: reexpande a view system_users_active
-- ----------------------------------------------------------------------------
-- A migration 20260808000030 adicionou colunas em system_users (perfil, cargo,
-- unidade_organizacional, peticionante, participa_distribuicao_padrao,
-- status_projuris), MAS a view `system_users_active` é `SELECT *` — e no Postgres
-- o `*` é CONGELADO na criação da view. Resultado: `listUsers` (que lê da view)
-- quebrava com "column system_users_active.perfil does not exist".
--
-- Correção: CREATE OR REPLACE VIEW reexpande o `*` incluindo as colunas novas.
-- (Mesmo gotcha tratado no M6 para system_parcelas_active.)
--
-- Aplicar via (de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000050_refresh_system_users_active_view.sql
-- ============================================================================

CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;

GRANT SELECT ON system_users_active TO anon, authenticated, service_role;
