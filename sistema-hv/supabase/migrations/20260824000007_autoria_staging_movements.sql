-- ============================================================================
-- Registra QUEM preparou cada linha (achado do QA: o userId chegava e era
-- descartado com `void userId`).
--
--   • movements.criado_por    → quem mandou a inicial pela ficha Judicial
--     (diferente de `decidido_por`, que é quem DECIDIU o que fazer com ela)
--   • staging.preparado_por   → quem colocou a tarefa na fila
--     (diferente de `distribuido_por`, que é quem apertou "Distribuir")
-- ============================================================================

ALTER TABLE system_distribution_movements
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES system_users(id);

ALTER TABLE system_distribution_staging
  ADD COLUMN IF NOT EXISTS preparado_por UUID REFERENCES system_users(id);

COMMENT ON COLUMN system_distribution_movements.criado_por IS
  'Quem originou a linha no SHV (ex.: mandou a inicial pela ficha Judicial). Nulo quando veio do sync do ProJuris.';
COMMENT ON COLUMN system_distribution_staging.preparado_por IS
  'Quem decidiu distribuir e colocou a tarefa na fila de revisão.';
