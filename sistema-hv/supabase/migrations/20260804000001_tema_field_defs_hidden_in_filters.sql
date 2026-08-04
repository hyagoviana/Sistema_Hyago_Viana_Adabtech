-- ============================================================================
-- Sistema HV — Migration — A2 (Reunião 2026-08-03): "Ocultar do filtro"
-- ----------------------------------------------------------------------------
-- Adiciona `hidden_in_filters` em system_tema_field_defs. INDEPENDENTE de:
--   • active           — "ocultar de TUDO" (a def some da ficha/lista/filtro).
--   • hidden_in_list    — some só da COLUNA da Lista (segue no filtro e na ficha).
--   • hidden_in_filters — some só do PAINEL DE FILTROS (lista + Kanban); CONTINUA
--                         visível na FICHA e (se hidden_in_list=false) na coluna.
-- Um campo é um LOCAL DE INFORMAÇÃO do tema — nem todo campo precisa ser filtro.
--
-- ADITIVA — só 1 coluna com DEFAULT seguro (FALSE reproduz o comportamento atual,
-- regressão zero nas linhas existentes). NÃO altera o CHECK de `type`, NÃO toca
-- system_cases/canonical_fields, NÃO mexe em triggers. Idempotente (ADD COLUMN
-- IF NOT EXISTS). Recria a view `_active` (SELECT * é congelado na criação).
-- Molde: 20260731000001_tema_field_defs_scope_multi.sql (hidden_in_list).
-- ============================================================================

ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS hidden_in_filters BOOLEAN NOT NULL DEFAULT FALSE;

-- Reexpande a view p/ expor a coluna nova (SELECT * é congelado na criação).
CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
