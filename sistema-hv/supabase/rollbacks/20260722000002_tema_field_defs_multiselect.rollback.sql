-- ============================================================================
-- ROLLBACK — R2-09 — Tipo MÚLTIPLA ESCOLHA nos filtros por TEMA
-- ----------------------------------------------------------------------------
-- Volta o CHECK de `type` ao conjunto SEM 'multiselect' (mantém 'boolean'). Só é
-- seguro se não houver defs com type='multiselect'. Se houver, oculte/migre antes:
--   UPDATE system_tema_field_defs SET deleted_at = NOW() WHERE type = 'multiselect';
-- ============================================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'system_tema_field_defs'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE system_tema_field_defs DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE system_tema_field_defs
    ADD CONSTRAINT system_tema_field_defs_type_check
    CHECK (type IN ('text', 'select', 'money', 'number', 'date', 'boolean'));
END $$;
