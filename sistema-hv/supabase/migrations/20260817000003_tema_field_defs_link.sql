-- ============================================================================
-- #9 (melhorias 2026-08-17) — novo TIPO de campo "link" (URL clicável)
-- ----------------------------------------------------------------------------
-- Só RELAXA o CHECK de `type` em system_tema_field_defs para incluir 'link'
-- (mantém os tipos já existentes). Não cria coluna; o valor continua em
-- system_cases.canonical_fields (texto da URL). Idempotente.
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
    CHECK (type IN ('text', 'select', 'multiselect', 'money', 'number', 'date', 'boolean', 'link'));
END $$;
