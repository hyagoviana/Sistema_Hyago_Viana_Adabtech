-- ============================================================================
-- Sistema HV — Migration 0024 — Coluna `rg` em system_clients (Melhoria 2)
-- ----------------------------------------------------------------------------
-- O formulário de cadastro do cliente passa a coletar o RG (apenas no caso de
-- pessoa física / CPF). Campo opcional no banco — a obrigatoriedade condicional
-- (PF) é validada na aplicação por Zod.
-- ============================================================================

ALTER TABLE system_clients
  ADD COLUMN IF NOT EXISTS rg TEXT;
