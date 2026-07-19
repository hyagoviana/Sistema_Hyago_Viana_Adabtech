-- ============================================================================
-- Sistema HV — Temas T2 — Pasta própria do TEMA no Drive — 2026-07-19
-- ----------------------------------------------------------------------------
-- Cada TEMA passa a ter uma PASTA-RAIZ própria no Google Drive (dentro da pasta
-- "tema" configurada em GOOGLE_DRIVE_TEMAS_ROOT_FOLDER_ID). Guardamos o id/url
-- dessa pasta no próprio tema. ADITIVO / regressão zero: só adiciona 2 colunas
-- nullable e recria a view (SELECT * → reflete as colunas novas no fim).
--
-- Regra de ouro: NÃO toca system_cases / trigger / CHECKs. Idempotente.
-- ============================================================================

ALTER TABLE system_temas ADD COLUMN IF NOT EXISTS drive_folder_id  TEXT;
ALTER TABLE system_temas ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

-- A view é SELECT * — CREATE OR REPLACE incorpora as colunas novas (no fim).
CREATE OR REPLACE VIEW system_temas_active AS
  SELECT * FROM system_temas WHERE deleted_at IS NULL;

GRANT SELECT ON system_temas_active TO anon, authenticated, service_role;
