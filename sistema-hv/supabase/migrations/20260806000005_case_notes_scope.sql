-- ============================================================================
-- Sistema HV — Migration — F1: SCOPE nas notas do caso (comentários do financeiro)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-05 (Story F1). ADITIVA/idempotente.
--
-- OBJETIVO: separar os comentários EXCLUSIVOS do módulo financeiro das notas
-- gerais do caso, reusando a tabela `system_case_notes` (decisão D-F2). Uma
-- coluna `scope TEXT NOT NULL DEFAULT 'geral'` divide as notas em baldes:
--   - 'geral'      → bloco de Notas da ficha comum (comportamento atual);
--   - 'financeiro' → comentários dentro do submenu financeiro (gate financeiro).
--
-- REGRESSÃO ZERO: a coluna nasce 'geral' (todas as notas existentes ficam no
-- balde geral, aparecendo como hoje). A view _active é apenas recriada
-- (SELECT * pega a coluna nova). Nenhuma outra tabela é tocada.
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260806000005_case_notes_scope.sql
-- ============================================================================

ALTER TABLE system_case_notes
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'geral';

-- Guard-rail: só 'geral' | 'financeiro' são válidos hoje. Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_case_notes_scope_chk'
  ) THEN
    ALTER TABLE system_case_notes
      ADD CONSTRAINT system_case_notes_scope_chk
      CHECK (scope IN ('geral', 'financeiro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_case_notes_case_scope
  ON system_case_notes (case_id, scope) WHERE deleted_at IS NULL;

-- View _active recriada (SELECT * pega a coluna nova automaticamente).
CREATE OR REPLACE VIEW system_case_notes_active AS
  SELECT * FROM system_case_notes WHERE deleted_at IS NULL;

GRANT SELECT ON system_case_notes_active TO anon, authenticated, service_role;
