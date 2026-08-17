-- ============================================================================
-- #8 (melhorias 2026-08-17) — SUBTÍTULO por campo (rótulo das ocorrências)
-- ----------------------------------------------------------------------------
-- Para campos multi-ocorrência (texto/número/data com "máx. de linhas"), o
-- admin pode rotular cada linha:
--   subtitle_mode = 'auto'   → usa o rótulo do campo enumerado (Rótulo 1, 2, …)
--   subtitle_mode = 'custom' → usa os textos de `subtitles` (um por linha)
--   NULL                     → sem subtítulo (comportamento atual)
-- Aditivo/idempotente. Não toca em valores (system_cases.canonical_fields).
-- ============================================================================

ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS subtitle_mode TEXT,
  ADD COLUMN IF NOT EXISTS subtitles JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_tema_field_defs_subtitle_mode_chk'
  ) THEN
    ALTER TABLE system_tema_field_defs
      ADD CONSTRAINT system_tema_field_defs_subtitle_mode_chk
      CHECK (subtitle_mode IS NULL OR subtitle_mode IN ('auto', 'custom'));
  END IF;
END $$;
