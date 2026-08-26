-- ROLLBACK — C1. Volta os campos do cliente ao estado anterior.
-- LOSSY: campos criados como 'link'/'money' e as configurações de ocorrência,
-- subtítulo, dependência e vínculo somem. Rodar só se for realmente necessário.

-- Sem o field_type antigo, primeiro normaliza o que não existia lá atrás.
UPDATE system_client_field_defs SET field_type = 'text'   WHERE field_type = 'link';
UPDATE system_client_field_defs SET field_type = 'number' WHERE field_type = 'money';

DO $$
DECLARE v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'system_client_field_defs' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%field_type%' LIMIT 1;
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE system_client_field_defs DROP CONSTRAINT %I', v_conname);
  END IF;
  ALTER TABLE system_client_field_defs
    ADD CONSTRAINT system_client_field_defs_field_type_check
    CHECK (field_type IN ('text','textarea','number','date','select','multiselect','boolean'));
END $$;

CREATE OR REPLACE VIEW system_client_field_defs_active AS
SELECT id, organization_id, key, label, field_type, options, required, help_text,
       ordem, active, created_by, created_at, updated_at, deleted_at, appears_in_cases
FROM system_client_field_defs
WHERE deleted_at IS NULL;

ALTER TABLE system_client_field_defs
  DROP CONSTRAINT IF EXISTS system_client_field_defs_max_occ_chk,
  DROP CONSTRAINT IF EXISTS system_client_field_defs_initial_occ_chk,
  DROP CONSTRAINT IF EXISTS system_client_field_defs_subtitle_mode_chk,
  DROP CONSTRAINT IF EXISTS system_client_field_defs_no_self_link_chk,
  DROP CONSTRAINT IF EXISTS system_client_field_defs_no_self_parent_chk,
  DROP COLUMN IF EXISTS max_occurrences,
  DROP COLUMN IF EXISTS initial_occurrences,
  DROP COLUMN IF EXISTS subtitle_mode,
  DROP COLUMN IF EXISTS subtitles,
  DROP COLUMN IF EXISTS parent_field_def_id,
  DROP COLUMN IF EXISTS linked_field_def_id,
  DROP COLUMN IF EXISTS hidden_in_list,
  DROP COLUMN IF EXISTS hidden_in_filters;

ALTER TABLE system_tema_field_defs
  DROP CONSTRAINT IF EXISTS system_tema_field_defs_no_self_link_chk,
  DROP COLUMN IF EXISTS linked_field_def_id;
