-- ============================================================================
-- #10 (melhorias 2026-08-17) — "Cadeado" de edição dos campos do caso
-- ----------------------------------------------------------------------------
-- Chave que bloqueia o painel "Dados do caso" para SÓ LEITURA, evitando
-- preenchimento indevido. Aditivo/idempotente; default = desbloqueado.
-- ============================================================================

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS fields_locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN system_cases.fields_locked IS
  'Cadeado (#10): quando true, os campos do caso ficam só-leitura na ficha.';
