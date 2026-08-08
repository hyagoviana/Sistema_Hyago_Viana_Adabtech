-- ============================================================================
-- Sistema HV — Migration — M2: Campo "Observações" do caso (texto livre)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-07 (Story M2). ADITIVA/idempotente.
--
-- OBJETIVO: um campo "Observações" de texto grande e livre, do caso inteiro,
-- separado da linha do tempo/notas. Não emite evento; é só uma string que fica
-- registrada no caso. Coluna nullable → casos existentes ficam NULL (regressão
-- zero). Editável por quem tem operacional/comercial:edit (gate no RPC).
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260807000001_case_observacoes.sql
-- ============================================================================

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS observacoes TEXT;
