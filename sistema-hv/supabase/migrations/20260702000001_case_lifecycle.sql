-- ============================================================================
-- Sistema HV — Migration 0030 — S1-01: Estado de ciclo de vida do caso
-- ----------------------------------------------------------------------------
-- Materializa o ciclo de vida do CASO (não da pessoa) como estado de 1ª classe:
--   lifecycle ∈ {LEAD, CLIENTE, PERDIDO}. Hoje o estado é inferido de flags
--   implícitas (aguardando_assinatura_at = LEAD; assinatura_liberada_at = CLIENTE)
--   e "lead perdido" não tem estado terminal. Esta migration cria a coluna,
--   as invariantes no banco, o backfill idempotente e recria a view.
--
-- Invariantes (R-ARCH-2) — garantidas no banco:
--   - assinatura_liberada_at IS NOT NULL  ⇒ lifecycle <> 'LEAD'  (CLIENTE ou
--     PERDIDO — o "<>" e não "= CLIENTE" permite a reversão CLIENTE→PERDIDO da
--     S1-01b, mantendo o carimbo de assinatura no histórico). Correção @sm.
--   - perdido_at IS NOT NULL              ⇒ lifecycle = 'PERDIDO'.
--
-- Regras de ouro respeitadas:
--   2) toda migration que toca colunas de system_cases recria system_cases_active
--      (DROP+CREATE) com grants anon/authenticated/service_role.
--   6) NÃO recriar trg_system_cases_bifurcacao (dropado na 0022 — fica dropado).
--   7) escrita de lifecycle é RPC-only (centralizada em cases-service).
--
-- Convive com: system_fn_sync_stage_ids (trigger BEFORE de projeção) e
--   system_fn_entrar_financeiro. NÃO introduz trigger AFTER conflitante.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Colunas novas. Default 'LEAD' (estado menos disruptivo; novos casos
--    comerciais nascem LEAD). Idempotente via IF NOT EXISTS.
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'LEAD',
  ADD COLUMN IF NOT EXISTS perdido_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS perdido_motivo TEXT;

-- Domínio do lifecycle (CHECK simples — sempre válido, não barra backfill).
ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_lifecycle_domain_chk;
ALTER TABLE system_cases
  ADD CONSTRAINT system_cases_lifecycle_domain_chk
  CHECK (lifecycle IN ('LEAD', 'CLIENTE', 'PERDIDO'));

-- ----------------------------------------------------------------------------
-- 2) Backfill idempotente (só toca quem ainda está no default 'LEAD'):
--    caso com procuração já liberada (assinatura_liberada_at) → CLIENTE.
--    O resto permanece 'LEAD' (default). A regra por documento ASSINADO e os
--    casos ambíguos/legados assinados-por-fora ficam para a S1-06.
-- ----------------------------------------------------------------------------
UPDATE system_cases
   SET lifecycle = 'CLIENTE'
 WHERE assinatura_liberada_at IS NOT NULL
   AND lifecycle = 'LEAD';

-- ----------------------------------------------------------------------------
-- 3) Invariantes de consistência. Aplicadas DEPOIS do backfill; adicionadas
--    como NOT VALID + VALIDATE para não travar caso haja dado legado divergente
--    (o VALIDATE reprova a migration explicitamente se algo estiver inconsistente,
--    em vez de um erro genérico de ADD CONSTRAINT).
-- ----------------------------------------------------------------------------
-- Procuração liberada ⇒ não pode ser LEAD (CLIENTE ou PERDIDO).
ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_assinatura_lifecycle_chk;
ALTER TABLE system_cases
  ADD CONSTRAINT system_cases_assinatura_lifecycle_chk
  CHECK (assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD') NOT VALID;
ALTER TABLE system_cases
  VALIDATE CONSTRAINT system_cases_assinatura_lifecycle_chk;

-- perdido_at ⇒ lifecycle = 'PERDIDO'.
ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_perdido_lifecycle_chk;
ALTER TABLE system_cases
  ADD CONSTRAINT system_cases_perdido_lifecycle_chk
  CHECK (perdido_at IS NULL OR lifecycle = 'PERDIDO') NOT VALID;
ALTER TABLE system_cases
  VALIDATE CONSTRAINT system_cases_perdido_lifecycle_chk;

-- ----------------------------------------------------------------------------
-- 4) Índice parcial p/ os filtros das abas Leads/Clientes (casos vivos).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_system_cases_lifecycle
  ON system_cases(lifecycle)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 5) Refresh da view (c.* é fixado na criação — DROP+CREATE para expor as
--    colunas novas: lifecycle, perdido_at, perdido_motivo). Mantém grants.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT c.*, cli.full_name AS client_name, cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
