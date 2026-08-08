-- ============================================================================
-- Sistema HV — Migration — M13 (T3): campo URGENTE/PRIORITÁRIO nativo do caso
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-07 (Story M13). Essa informação NÃO existe no ProJuris ("era
-- humana, na cabeça da pessoa") → é um campo NOSSO, marcável no caso, que
-- alimenta o `temporal_level` do motor (prioritário=1, urgente=2). Sem marca ⇒
-- normal (temporal 0). Coluna nullable → casos existentes ficam NULL (= normal).
--
-- Aplicar via (2× idempotente, de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000080_case_distribution_urgency.sql
-- ============================================================================

ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS distribution_urgency TEXT;

DO $$ BEGIN
  ALTER TABLE system_cases ADD CONSTRAINT system_cases_distribution_urgency_check
    CHECK (distribution_urgency IS NULL OR distribution_urgency IN ('prioritario', 'urgente'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN system_cases.distribution_urgency IS
  'M13: urgência do caso p/ o motor (prioritario|urgente|NULL=normal) → temporal_level. Não vem do ProJuris.';
