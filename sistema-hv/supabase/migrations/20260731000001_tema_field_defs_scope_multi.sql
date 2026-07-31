-- ============================================================================
-- Sistema HV — Migration — Melhorias de CAMPOS por TEMA (reunião 2026-07-29)
-- ----------------------------------------------------------------------------
-- Reunião Adavio/Thiago 2026-07-29. Refina os campos personalizados por tema
-- (system_tema_field_defs). ADITIVA — só adiciona 3 colunas com DEFAULT seguro;
-- NÃO altera o CHECK de `type`, NÃO toca system_cases/canonical_fields, NÃO mexe
-- em triggers/bifurcação. Regressão zero: linhas existentes assumem os defaults
-- ('caso' / FALSE / 1) que reproduzem o comportamento atual.
--
-- COLUNAS:
--   • scope           — 'caso' (valor em system_cases.canonical_fields, por caso)
--                       ou 'cliente' (valor em system_clients.custom_fields,
--                       COMPARTILHADO entre todos os casos do cliente). Melhoria #3.
--   • hidden_in_list  — some da COLUNA da Lista sem sumir do painel de busca/ficha
--                       (o `active` continua sendo o "ocultar de tudo"). Melhoria #5.
--   • max_occurrences — nº de caixinhas do MESMO campo (ex.: vários períodos).
--                       1 = campo simples (hoje); >1 = valor vira ARRAY. Melhoria #6.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DO-blocks guardados p/ os CHECKs.
-- Recria a view _active (SELECT * precisa ser reexpandido p/ ver as colunas novas).
-- ============================================================================

ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS scope           TEXT    NOT NULL DEFAULT 'caso';
ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS hidden_in_list  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS max_occurrences INTEGER NOT NULL DEFAULT 1;

-- CHECK scope ∈ ('caso','cliente') — Postgres não tem ADD CONSTRAINT IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'system_tema_field_defs'
      AND c.conname = 'system_tema_field_defs_scope_check'
  ) THEN
    ALTER TABLE system_tema_field_defs
      ADD CONSTRAINT system_tema_field_defs_scope_check
      CHECK (scope IN ('caso', 'cliente'));
  END IF;
END $$;

-- CHECK max_occurrences entre 1 e 20 (limite de sanidade da UI).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'system_tema_field_defs'
      AND c.conname = 'system_tema_field_defs_max_occ_check'
  ) THEN
    ALTER TABLE system_tema_field_defs
      ADD CONSTRAINT system_tema_field_defs_max_occ_check
      CHECK (max_occurrences BETWEEN 1 AND 20);
  END IF;
END $$;

-- Reexpande a view p/ expor as colunas novas (SELECT * é congelado na criação).
CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
