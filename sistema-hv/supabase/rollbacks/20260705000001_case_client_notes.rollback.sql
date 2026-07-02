-- Rollback S4-03 — Bloco de notas (cliente e caso).
-- Dropa as 2 tabelas (CASCADE remove views _active, triggers, policies, índices).
-- NÃO toca system_cases nem system_cases_active. NÃO recria trg_system_cases_bifurcacao.

DROP VIEW IF EXISTS system_client_notes_active;
DROP VIEW IF EXISTS system_case_notes_active;

DROP TABLE IF EXISTS system_client_notes CASCADE;
DROP TABLE IF EXISTS system_case_notes CASCADE;
