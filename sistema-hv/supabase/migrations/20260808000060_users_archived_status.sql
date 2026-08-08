-- ============================================================================
-- Sistema HV — Migration — M17: usuário ARQUIVADO (registro sem acesso)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-07 (Story M17). Decisão T0 = Opção A: novo status 'ARCHIVED'.
--
-- Colaboradores arquivados/desabilitados no ProJuris (já saíram; e-mail do Drive
-- excluído) entram como REGISTRO SEM ACESSO em system_users — existem para
-- vínculo/autoria (espelho de tarefas do ProJuris não quebra), mas NÃO têm conta
-- Auth, NÃO recebem convite e NÃO logam. 'ARCHIVED' ≠ ACTIVE ⇒ o gate
-- (requireAuth/requireRole/requireModule) já nega acesso, e qualquer seletor que
-- filtra status='ACTIVE' já os esconde automaticamente.
--
-- ARCHIVED ≠ soft-delete: mantemos deleted_at IS NULL (continua na view _active
-- para joins de autoria). O que impede login é a ausência de conta Auth + status.
--
-- Reexpande a view system_users_active por garantia (SELECT * — sem colunas
-- novas aqui, mas mantém o padrão seguro do M8).
--
-- Aplicar via (2× idempotente, de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000060_users_archived_status.sql
-- ============================================================================

ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_status_check;
ALTER TABLE system_users ADD CONSTRAINT system_users_status_check
  CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'));

CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;
GRANT SELECT ON system_users_active TO anon, authenticated, service_role;
