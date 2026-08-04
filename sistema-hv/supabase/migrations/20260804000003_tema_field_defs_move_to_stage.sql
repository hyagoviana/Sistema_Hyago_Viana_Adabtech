-- ============================================================================
-- Sistema HV — Migration — A5 (5c, Reunião 2026-08-03): CHECKBOX de auto-avanço
-- ----------------------------------------------------------------------------
-- Um campo do tema do tipo `boolean` (Sim/Não) ganha o atributo OPCIONAL
-- `move_to_stage_slug`: ao MARCAR o checkbox como "Sim" na ficha do caso, o caso
-- é MOVIDO para a etapa OPERACIONAL indicada por esse slug. É o "1 OK que
-- auto-avança" — distinto do CHECKLIST (N itens por etapa, recebimento parcial).
--
-- Regressão zero: DEFAULT NULL = o campo boolean NÃO move nada (comportamento
-- atual). Só campos boolean usam a coluna; para os demais tipos ela fica NULL.
-- O slug é um slug op de system_pipeline_stages do tema/funil (validado no app).
--
-- ADITIVA — 1 coluna com DEFAULT seguro (NULL). NÃO altera o CHECK de `type`,
-- NÃO toca system_cases/canonical_fields, NÃO mexe em triggers. Idempotente
-- (ADD COLUMN IF NOT EXISTS). Recria a view `_active` (SELECT * é congelado na
-- criação). Molde: 20260804000001_tema_field_defs_hidden_in_filters.sql.
-- ============================================================================

ALTER TABLE system_tema_field_defs
  ADD COLUMN IF NOT EXISTS move_to_stage_slug TEXT NULL;

-- Reexpande a view p/ expor a coluna nova (SELECT * é congelado na criação).
CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
