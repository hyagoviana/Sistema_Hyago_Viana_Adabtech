-- ============================================================================
-- ROLLBACK — M15: coluna `equipe` + módulo 'judicial'
-- ----------------------------------------------------------------------------
-- Simétrico ao 20260808000070. Idempotente. NOTA: se já houver linhas de
-- perm com module='judicial', o ADD CONSTRAINT sem 'judicial' falharia — por
-- isso o rollback também apaga essas linhas antes.
-- ============================================================================

DELETE FROM system_user_module_perms WHERE module = 'judicial';

ALTER TABLE system_user_module_perms DROP CONSTRAINT IF EXISTS system_user_module_perms_module_check;
ALTER TABLE system_user_module_perms ADD CONSTRAINT system_user_module_perms_module_check
  CHECK (module IN ('comercial', 'operacional', 'financeiro', 'controladoria',
                    'inteligencia', 'marketing', 'sistema'));

ALTER TABLE system_users DROP COLUMN IF EXISTS equipe;

CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;
GRANT SELECT ON system_users_active TO anon, authenticated, service_role;
