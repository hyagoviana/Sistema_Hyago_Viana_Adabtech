-- ============================================================================
-- ROLLBACK — M8: modelo de cadastro do colaborador + DUAS flags do motor
-- ----------------------------------------------------------------------------
-- Simétrico ao 20260808000030_system_users_cadastro_colaborador.sql. Idempotente.
-- Remove as CHECKs e as colunas adicionadas em system_users.
--
-- Aplicar via (de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/rollbacks/20260808000030_system_users_cadastro_colaborador.rollback.sql
-- ============================================================================

ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_perfil_check;
ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_cargo_check;
ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_status_projuris_check;

ALTER TABLE system_users
  DROP COLUMN IF EXISTS perfil,
  DROP COLUMN IF EXISTS cargo,
  DROP COLUMN IF EXISTS unidade_organizacional,
  DROP COLUMN IF EXISTS peticionante,
  DROP COLUMN IF EXISTS participa_distribuicao_padrao,
  DROP COLUMN IF EXISTS status_projuris;
