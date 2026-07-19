-- ============================================================================
-- Sistema HV — Endurecimento — RLS em system_user_module_perms — 2026-07-19
-- ----------------------------------------------------------------------------
-- A tabela de OVERRIDES de permissão (R3-01) nasceu com GRANT a anon/authenticated
-- e SEM RLS (migration 20260718000001). Por ser DADO DE AUTORIZAÇÃO, isso deixava
-- um vetor teórico: um cliente com a anon/authenticated key poderia escrever direto
-- (via PostgREST) e escalar o próprio privilégio, contornando o gate admin do RPC.
--
-- O app SÓ acessa esta tabela pelo servidor via service_role (getSupabaseAdmin,
-- em rbac-perms-service.ts) — e service_role BYPASSA RLS. Logo, habilitar RLS
-- SEM policies permissivas (deny-by-default para anon/authenticated) fecha o vetor
-- sem afetar nenhuma leitura/escrita real do app.
--
-- Alinha esta tabela ao padrão das demais system_* (RLS on; app usa service_role).
-- ADITIVO / regressão zero. Idempotente.
-- ============================================================================

ALTER TABLE system_user_module_perms ENABLE ROW LEVEL SECURITY;

-- Sem CREATE POLICY: com RLS habilitado e nenhuma policy, anon/authenticated são
-- negados por padrão; service_role (usado pelo app) bypassa RLS normalmente.
-- Revoga também os grants amplos herdados da migration original — redundante com
-- a RLS, mas deixa a intenção explícita (só o servidor toca esta tabela).
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE system_user_module_perms
  FROM anon, authenticated;
