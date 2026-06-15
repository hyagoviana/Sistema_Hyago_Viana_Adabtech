-- ============================================================================
-- Sistema HV — Migration — Relaxa CHECK de case_type
-- ----------------------------------------------------------------------------
-- Com categorias dinâmicas (service_types), o admin pode criar tipos novos.
-- O CHECK fixo dos 6 valores originais impedia a criação de casos com tipos
-- dinâmicos. A fonte da verdade agora é service_type_id; case_type vira texto
-- livre (slug do service_type).
-- ============================================================================
ALTER TABLE system_cases DROP CONSTRAINT IF EXISTS system_cases_case_type_check;
