-- ============================================================================
-- ROLLBACK — Migration 0031 (S1-05: views Leads/Clientes/Perdidos)
-- ----------------------------------------------------------------------------
-- Remove as views derivadas. NÃO toca system_cases nem system_cases_active.
-- ============================================================================
DROP VIEW IF EXISTS system_clients_leads;
DROP VIEW IF EXISTS system_clients_clientes;
DROP VIEW IF EXISTS system_clients_perdidos;
