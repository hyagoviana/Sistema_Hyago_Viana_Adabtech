-- ============================================================================
-- Sistema HV — Migration — M6: Nº da fatura do Conta Azul por cobrança/parcela
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-07 (Story M6). ADITIVA/idempotente.
--
-- OBJETIVO: permitir anotar MANUALMENTE o número da fatura do Conta Azul em
-- cada cobrança/parcela (um caso tem várias cobranças no CA; a identificação
-- hoje é manual). Coluna TEXT nullable, sem CHECK — identificação livre.
-- Casos/parcelas existentes ficam NULL (regressão zero). NÃO há sync com a API
-- do Conta Azul aqui — é preenchimento humano (a integração CA×ProJuris é F4).
--
-- RLS/triggers de system_parcelas (auditoria system_fn_audit + updated_at) já
-- cobrem a linha — nenhuma policy nova.
--
-- GOTCHA: system_parcelas_active é VIEW `SELECT *`. No Postgres o `*` é expandido
-- na criação, então a coluna nova NÃO aparece na view automaticamente — é preciso
-- reexecutar CREATE OR REPLACE VIEW para reexpandir o `*` (senão listParcelas,
-- que lê da view, não devolve a coluna nova).
--
-- Aplicar via (2× idempotente, de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000020_parcela_contaazul_fatura.sql
-- ============================================================================

ALTER TABLE system_parcelas
  ADD COLUMN IF NOT EXISTS contaazul_fatura_numero TEXT;

COMMENT ON COLUMN system_parcelas.contaazul_fatura_numero IS
  'M6: nº da fatura do Conta Azul da cobrança (preenchimento manual, identificação livre).';

-- Reexpande o SELECT * da view para incluir a coluna nova (ver GOTCHA acima).
CREATE OR REPLACE VIEW system_parcelas_active AS
  SELECT * FROM system_parcelas;

GRANT SELECT ON system_parcelas_active TO anon, authenticated, service_role;
