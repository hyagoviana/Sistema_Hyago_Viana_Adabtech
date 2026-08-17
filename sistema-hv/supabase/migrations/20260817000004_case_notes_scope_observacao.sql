-- ============================================================================
-- #6 (melhorias 2026-08-17) — novo escopo 'observacao' nas notas do caso
-- ----------------------------------------------------------------------------
-- As "Observações gerais" do caso passam a ser gravadas como notas com
-- scope='observacao' (painel próprio, no modelo da linha do tempo). Só RELAXA o
-- CHECK de system_case_notes.scope para incluir 'observacao'. Idempotente.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_case_notes_scope_chk') THEN
    ALTER TABLE system_case_notes DROP CONSTRAINT system_case_notes_scope_chk;
  END IF;
  ALTER TABLE system_case_notes
    ADD CONSTRAINT system_case_notes_scope_chk
    CHECK (scope IN ('geral', 'financeiro', 'observacao'));
END $$;
