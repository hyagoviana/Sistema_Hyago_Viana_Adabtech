-- ============================================================================
-- Sistema HV — Migration — M15: coluna `equipe` em system_users + módulo 'judicial'
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-07 (Story M15). ADITIVA/idempotente. Prepara o import de
-- colaboradores:
--   (1) `equipe` (Time/Equipe da planilha: Equipe 1..5). Nome `equipe` em vez de
--       `time` para evitar a palavra reservada do SQL. Reexpande a view.
--   (2) 'judicial' no CHECK de system_user_module_perms.module — a planilha tem
--       a coluna "Ver Judicial" e a aba Judicial existe no caso.
--
-- Aplicar via (2× idempotente, de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000070_users_equipe_and_judicial_module.sql
-- ============================================================================

ALTER TABLE system_users ADD COLUMN IF NOT EXISTS equipe TEXT;

CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;
GRANT SELECT ON system_users_active TO anon, authenticated, service_role;

ALTER TABLE system_user_module_perms DROP CONSTRAINT IF EXISTS system_user_module_perms_module_check;
ALTER TABLE system_user_module_perms ADD CONSTRAINT system_user_module_perms_module_check
  CHECK (module IN ('comercial', 'operacional', 'financeiro', 'controladoria',
                    'inteligencia', 'marketing', 'sistema', 'judicial'));
