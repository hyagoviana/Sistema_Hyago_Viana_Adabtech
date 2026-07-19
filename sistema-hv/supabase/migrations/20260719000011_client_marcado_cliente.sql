-- ============================================================================
-- Sistema HV — Cadastro — marcar pessoa como CLIENTE manualmente — 2026-07-19
-- ----------------------------------------------------------------------------
-- Além de virar CLIENTE ao ter um caso assinado, o owner pode marcar a pessoa
-- como cliente DIRETO no cadastro (chave "É um cliente") ou pela ficha (botão
-- "Tornar cliente"). Guardamos o timestamp em `marcado_cliente_at`. A régua de
-- listagem passa a ser: CLIENTE = tem caso lifecycle='CLIENTE' OU
-- marcado_cliente_at IS NOT NULL; LEAD = nenhum dos dois.
-- ADITIVO / regressão zero. Idempotente.
-- ============================================================================

ALTER TABLE system_clients ADD COLUMN IF NOT EXISTS marcado_cliente_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW system_clients_active AS
  SELECT * FROM system_clients WHERE deleted_at IS NULL;

GRANT SELECT ON system_clients_active TO anon, authenticated, service_role;
