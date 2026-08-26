-- ============================================================================
-- Sistema HV — Migration — C1 — Campos do CLIENTE no nível dos campos do CASO
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-26 (Thiago): "aqui a gente já tem, por exemplo, a opção de ter
-- um campo personalizado caso que é link, um que tem linhas adicionais, que podem
-- ter subtítulos, que podem ser dependentes (…) e aí quando a gente abre os
-- campos personalizados do cliente, a gente não tem essas mesmas melhorias".
--
-- Traz para `system_client_field_defs` o que só existia em
-- `system_tema_field_defs`, com os MESMOS nomes de coluna e a MESMA semântica —
-- para a UI poder compartilhar controles em vez de duplicar regra:
--
--   max_occurrences / initial_occurrences  teto e nº de linhas de largada
--   subtitle_mode / subtitles              rótulo por linha (auto | custom)
--   parent_field_def_id                    campo DEPENDENTE (só edita se o pai tem valor)
--   hidden_in_list / hidden_in_filters     esconder da lista e dos filtros
--   field_type ganha 'link' e 'money'
--
-- E cria, nas DUAS tabelas, o campo VINCULADO — pedido novo da mesma reunião:
-- "além do dependente, um vinculado. Não é que ele depende daquele outro, é que
-- eles são juntos (…) na hora que eu marco que esse aqui é vinculado no outro,
-- eles aparecem juntinhos". É só APRESENTAÇÃO: não condiciona, não bloqueia.
--
-- Tudo aditivo, com DEFAULTs que preservam o comportamento atual (campo existente
-- fica 1 linha, sem subtítulo, sem pai, visível). Recria a view `_active`, que
-- lista colunas explicitamente e por isso não enxergaria as novas.
-- ============================================================================

ALTER TABLE system_client_field_defs
  ADD COLUMN IF NOT EXISTS max_occurrences     INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS initial_occurrences INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtitle_mode       TEXT,
  ADD COLUMN IF NOT EXISTS subtitles           JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_field_def_id UUID REFERENCES system_client_field_defs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_field_def_id UUID REFERENCES system_client_field_defs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_in_list      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_in_filters   BOOLEAN NOT NULL DEFAULT FALSE;

-- O campo vinculado também vale para os campos do CASO (o pedido nasceu olhando
-- a tela dos casos).
ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS linked_field_def_id UUID REFERENCES system_tema_field_defs(id) ON DELETE SET NULL;

COMMENT ON COLUMN system_client_field_defs.linked_field_def_id IS
  'C1: campo VINCULADO (aparecem juntos na tela). Diferente de parent_field_def_id (dependente, que condiciona a edicao). So apresentacao.';
COMMENT ON COLUMN system_tema_field_defs.linked_field_def_id IS
  'C1: campo VINCULADO (aparecem juntos na tela). Diferente de parent_field_def_id (dependente).';

-- ----------------------------------------------------------------------------
-- CHECKs de sanidade (mesmos limites já usados nos campos do tema)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_client_field_defs_max_occ_chk') THEN
    ALTER TABLE system_client_field_defs
      ADD CONSTRAINT system_client_field_defs_max_occ_chk CHECK (max_occurrences BETWEEN 1 AND 20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_client_field_defs_initial_occ_chk') THEN
    ALTER TABLE system_client_field_defs
      ADD CONSTRAINT system_client_field_defs_initial_occ_chk
      CHECK (initial_occurrences BETWEEN 1 AND 20 AND initial_occurrences <= max_occurrences);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_client_field_defs_subtitle_mode_chk') THEN
    ALTER TABLE system_client_field_defs
      ADD CONSTRAINT system_client_field_defs_subtitle_mode_chk
      CHECK (subtitle_mode IS NULL OR subtitle_mode IN ('auto', 'custom'));
  END IF;

  -- Auto-referência é erro de operação, não criatividade: barra no banco.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_client_field_defs_no_self_link_chk') THEN
    ALTER TABLE system_client_field_defs
      ADD CONSTRAINT system_client_field_defs_no_self_link_chk
      CHECK (linked_field_def_id IS NULL OR linked_field_def_id <> id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_client_field_defs_no_self_parent_chk') THEN
    ALTER TABLE system_client_field_defs
      ADD CONSTRAINT system_client_field_defs_no_self_parent_chk
      CHECK (parent_field_def_id IS NULL OR parent_field_def_id <> id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_tema_field_defs_no_self_link_chk') THEN
    ALTER TABLE system_tema_field_defs
      ADD CONSTRAINT system_tema_field_defs_no_self_link_chk
      CHECK (linked_field_def_id IS NULL OR linked_field_def_id <> id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- field_type ganha 'link' e 'money' (o do tema já tinha os dois)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'system_client_field_defs'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%field_type%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE system_client_field_defs DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE system_client_field_defs
    ADD CONSTRAINT system_client_field_defs_field_type_check
    CHECK (field_type IN ('text','textarea','number','date','select','multiselect','boolean','link','money'));
END $$;

-- ----------------------------------------------------------------------------
-- View _active recriada com as colunas novas (ela lista campo por campo)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW system_client_field_defs_active AS
SELECT
  id,
  organization_id,
  key,
  label,
  field_type,
  options,
  required,
  help_text,
  ordem,
  active,
  created_by,
  created_at,
  updated_at,
  deleted_at,
  appears_in_cases,
  max_occurrences,
  initial_occurrences,
  subtitle_mode,
  subtitles,
  parent_field_def_id,
  linked_field_def_id,
  hidden_in_list,
  hidden_in_filters
FROM system_client_field_defs
WHERE deleted_at IS NULL;
