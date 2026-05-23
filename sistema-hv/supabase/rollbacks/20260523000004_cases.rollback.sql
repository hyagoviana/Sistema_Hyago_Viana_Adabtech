-- Rollback Migration 0004 — Casos

DROP POLICY IF EXISTS system_case_events_select_own_org ON system_case_events;

DROP POLICY IF EXISTS system_cases_select_own_org ON system_cases;
DROP POLICY IF EXISTS system_cases_insert_own_org ON system_cases;
DROP POLICY IF EXISTS system_cases_update_own_org ON system_cases;
DROP POLICY IF EXISTS system_cases_delete_own_org ON system_cases;

DROP VIEW IF EXISTS system_cases_active;

DROP TABLE IF EXISTS system_case_events CASCADE;
DROP TABLE IF EXISTS system_cases CASCADE;

DROP FUNCTION IF EXISTS system_cases_status_changed_at_trg();
DROP SEQUENCE IF EXISTS seq_system_case_code;
