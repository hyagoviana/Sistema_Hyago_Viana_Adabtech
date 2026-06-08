-- ============================================================================
-- Sistema HV — Migration 0017 — Relaxa CHECK de macrostatus_op/fin
-- ----------------------------------------------------------------------------
-- Com etapas dinâmicas (S14), o admin pode criar etapas com slugs novos. O
-- dual-write grava macrostatus_* = slug da etapa, então o CHECK fixo dos 10/12
-- valores não pode mais barrar. A fonte da verdade passa a ser stage_*; macrostatus_*
-- vira projeção em texto livre. case_type_check fica (criação de caso ainda usa os 6).
-- ============================================================================
ALTER TABLE system_cases DROP CONSTRAINT IF EXISTS system_cases_macrostatus_op_check;
ALTER TABLE system_cases DROP CONSTRAINT IF EXISTS system_cases_macrostatus_fin_check;
