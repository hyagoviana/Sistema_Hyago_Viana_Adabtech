-- ============================================================================
-- ROLLBACK — M2: Campo "Observações" do caso (20260807000001)
-- ----------------------------------------------------------------------------
-- Remove a coluna observacoes de system_cases. Idempotente. Não há dado
-- derivado; DROP direto (o texto livre some com a coluna).
-- ============================================================================

ALTER TABLE system_cases
  DROP COLUMN IF EXISTS observacoes;
