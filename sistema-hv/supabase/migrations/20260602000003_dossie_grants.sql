-- ============================================================================
-- Sistema HV — Migration 0010 — Grants do dossiê (F3)
-- Sem GRANT explícito, os roles do PostgREST (service_role/anon/authenticated)
-- não acessam as tabelas novas. RLS continua sendo o gate de segurança.
-- ============================================================================

GRANT ALL ON TABLE
  system_case_tasks,
  system_case_deadlines,
  system_case_communications
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  system_case_tasks,
  system_case_deadlines,
  system_case_communications
  TO anon, authenticated;

GRANT SELECT ON
  system_case_tasks_active,
  system_case_deadlines_active,
  system_case_communications_active
  TO anon, authenticated, service_role;
