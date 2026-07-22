-- ============================================================================
-- Sistema HV — Migration — R2-09 — Tipo BOOLEAN nos filtros por TEMA (ADITIVA)
-- ----------------------------------------------------------------------------
-- Reunião 2026-07-22 (ajuste sistema hyago): os usuários constroem filtros por
-- TEMA e pediram, além de texto/escolha/data/número/valor, o tipo BOOLEAN
-- (Sim/Não). Esta migration só RELAXA o CHECK de `type` em system_tema_field_defs
-- para incluir 'boolean'. NÃO cria coluna nova; NÃO toca system_cases /
-- system_cases_active / trigger de bifurcação. O VALOR por caso continua em
-- system_cases.canonical_fields (S2-07), agora aceitando boolean (o RPC
-- updateCaseCanonicalFields já valida string|number|boolean|null).
--
-- Idempotente: descobre o nome real da constraint de CHECK da coluna `type`
-- (default do Postgres: system_tema_field_defs_type_check) e a recria incluindo
-- 'boolean'. Rollback simétrico em rollbacks/ (volta ao conjunto sem 'boolean';
-- só é seguro se não houver linhas com type='boolean').
-- ============================================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  -- Nome real da CHECK constraint da coluna `type` (evita depender do default).
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
