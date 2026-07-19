-- ============================================================================
-- Sistema HV — Temas — Subpastas "Casos" e "Contratação" do tema — 2026-07-19
-- ----------------------------------------------------------------------------
-- Cada TEMA tem, dentro da sua pasta no Drive, duas subpastas fixas:
--   • "Casos"       → documentos de caso vinculados ao tema
--   • "Contratação" → documentos de assinatura (procuração/contrato → ZapSign)
-- Guardamos o id de cada subpasta para criar as pastas de doc no lugar certo sem
-- procurar por nome toda vez. ADITIVO / regressão zero. Idempotente.
-- ============================================================================

ALTER TABLE system_temas ADD COLUMN IF NOT EXISTS drive_casos_folder_id       TEXT;
ALTER TABLE system_temas ADD COLUMN IF NOT EXISTS drive_contratacao_folder_id TEXT;

CREATE OR REPLACE VIEW system_temas_active AS
  SELECT * FROM system_temas WHERE deleted_at IS NULL;

GRANT SELECT ON system_temas_active TO anon, authenticated, service_role;
