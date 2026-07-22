-- ============================================================================
-- Sistema HV — Migration — R2-09 — Tipo MÚLTIPLA ESCOLHA nos filtros por TEMA
-- ----------------------------------------------------------------------------
-- Reunião 2026-07-22 (feedback): "escolha única" se sobrepõe ao campo texto; o
-- owner quer MÚLTIPLA ESCOLHA — admin cadastra N opções, usuário marca 1 ou mais.
-- Esta migration só RELAXA o CHECK de `type` em system_tema_field_defs para
-- incluir 'multiselect'. NÃO cria coluna; NÃO toca system_cases/view/trigger. O
-- VALOR por caso continua em system_cases.canonical_fields (S2-07), agora podendo
-- ser um ARRAY de strings (JSONB aceita nativamente).
--
-- Idempotente: descobre o nome real da CHECK constraint da coluna `type` e a
-- recria incluindo 'multiselect' (mantém os tipos já existentes). Rollback
-- simétrico (estreita p/ o conjunto sem 'multiselect' — só seguro sem linhas
-- desse tipo).
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
    CHECK (type IN ('text', 'select', 'multiselect', 'money', 'number', 'date', 'boolean'));
END $$;
