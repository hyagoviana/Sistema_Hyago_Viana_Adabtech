-- ============================================================================
-- Sistema HV — Migration 0005 — RPC pra ler nextval da sequence de case_code
-- ----------------------------------------------------------------------------
-- PostgREST não expõe nextval() diretamente; precisamos de wrapper SQL.
-- ============================================================================

CREATE OR REPLACE FUNCTION nextval_seq_system_case_code()
RETURNS BIGINT AS $$
  SELECT nextval('seq_system_case_code');
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION nextval_seq_system_case_code() TO service_role;
