-- ============================================================================
-- ROLLBACK — TK1 — volta o status da tarefa ao domínio antigo
-- ----------------------------------------------------------------------------
--   CONCLUIDA_SUCESSO      -> CONCLUIDA
--   CONCLUIDA_SEM_SUCESSO  -> CONCLUIDA   (o "sem sucesso" não existe lá atrás;
--                                          a informação se perde — é o preço de
--                                          voltar, e está avisado)
--   CANCELADA              -> PENDENTE    (idem: cancelamento não existia)
--   EM_ANDAMENTO           -> EM_ANDAMENTO (fica)
--
-- Como o de-para de volta é LOSSY, rodar só se for realmente necessário.
-- ============================================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'system_case_tasks'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE system_case_tasks DROP CONSTRAINT %I', v_conname);
  END IF;

  UPDATE system_case_tasks SET status = 'CONCLUIDA' WHERE status IN ('CONCLUIDA_SUCESSO', 'CONCLUIDA_SEM_SUCESSO');
  UPDATE system_case_tasks SET status = 'PENDENTE'  WHERE status = 'CANCELADA';

  ALTER TABLE system_case_tasks
    ADD CONSTRAINT system_case_tasks_status_check
    CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA'));

  ALTER TABLE system_case_tasks ALTER COLUMN status SET DEFAULT 'PENDENTE';
END $$;
