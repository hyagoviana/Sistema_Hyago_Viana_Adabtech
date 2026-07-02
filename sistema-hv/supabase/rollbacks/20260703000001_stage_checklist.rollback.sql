-- Rollback S2-01 — Checklist por etapa (def + instância).
-- Dropa as 2 tabelas (CASCADE remove views _active, triggers, policies, índices).
-- NÃO toca system_cases nem system_cases_active. NÃO recria trg_system_cases_bifurcacao.

DROP VIEW IF EXISTS system_case_checklist_items_active;
DROP VIEW IF EXISTS system_stage_checklist_defs_active;

DROP TABLE IF EXISTS system_case_checklist_items CASCADE;
DROP TABLE IF EXISTS system_stage_checklist_defs CASCADE;
