-- ============================================================================
-- Sistema HV — Migration — A5 (Reunião 2026-08-05): "Linhas iniciais" (campo +)
-- ----------------------------------------------------------------------------
-- Adiciona `initial_occurrences` em system_tema_field_defs. Separa o conceito de
-- "quantas caixinhas aparecem de largada" (INITIAL) do "teto" (max_occurrences,
-- migration 20260731000001). Assim o campo multi-linha começa com N caixinhas e o
-- usuário adiciona ocorrências com o botão "+" até o teto.
--
--   • max_occurrences     — TETO de linhas (já existia; CHECK 1..20).
--   • initial_occurrences — nº de linhas MOSTRADAS de largada (NOVO). CHECK 1..20
--                           e <= max_occurrences (não faz sentido começar acima do
--                           teto). DEFAULT 1 ⇒ regressão zero: linhas existentes
--                           continuam começando com 1 caixinha.
--
-- ADITIVA — 1 coluna com DEFAULT seguro. NÃO altera o CHECK de `type`, NÃO toca
-- system_cases/canonical_fields, NÃO mexe em triggers. Idempotente (ADD COLUMN
-- IF NOT EXISTS + DO-blocks guardados p/ os CHECKs). Recria a view `_active`
-- (SELECT * é congelado na criação).
-- Molde: 20260731000001_tema_field_defs_scope_multi.sql (max_occurrences).
-- ============================================================================

ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS initial_occurrences INTEGER NOT NULL DEFAULT 1;

-- CHECK initial_occurrences entre 1 e 20 (mesmo limite de sanidade do teto).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'system_tema_field_defs'
      AND c.conname = 'system_tema_field_defs_initial_occ_check'
  ) THEN
    ALTER TABLE system_tema_field_defs
      ADD CONSTRAINT system_tema_field_defs_initial_occ_check
      CHECK (initial_occurrences BETWEEN 1 AND 20);
  END IF;
END $$;

-- CHECK initial_occurrences <= max_occurrences (não começa acima do teto).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'system_tema_field_defs'
      AND c.conname = 'system_tema_field_defs_initial_le_max_check'
  ) THEN
    ALTER TABLE system_tema_field_defs
      ADD CONSTRAINT system_tema_field_defs_initial_le_max_check
      CHECK (initial_occurrences <= max_occurrences);
  END IF;
END $$;

-- Reexpande a view p/ expor a coluna nova (SELECT * é congelado na criação).
CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
