-- ============================================================================
-- Sistema HV — Migration 0027 — Busca de clientes cobre endereço/município
-- ----------------------------------------------------------------------------
-- Amplia system_search_clients para também casar por ENDEREÇO (município, rua,
-- bairro — tudo no JSONB address), RG e telefone. Assim "londrina" traz todos os
-- clientes cujo município é Londrina. (Ajuste pedido em 2026-06-22.)
-- ============================================================================

CREATE OR REPLACE FUNCTION system_search_clients(p_term TEXT)
RETURNS SETOF system_clients
LANGUAGE sql
STABLE
AS $$
  SELECT *
    FROM system_clients
   WHERE deleted_at IS NULL
     AND (
       p_term IS NULL OR p_term = ''
       OR full_name ILIKE '%' || p_term || '%'
       OR (
         length(regexp_replace(p_term, '\D', '', 'g')) > 0
         AND cpf_cnpj ILIKE '%' || regexp_replace(p_term, '\D', '', 'g') || '%'
       )
       OR coalesce(rg, '') ILIKE '%' || p_term || '%'
       OR coalesce(email, '') ILIKE '%' || p_term || '%'
       OR (
         length(regexp_replace(p_term, '\D', '', 'g')) > 0
         AND coalesce(phone, '') ILIKE '%' || regexp_replace(p_term, '\D', '', 'g') || '%'
       )
       OR coalesce(address::text, '') ILIKE '%' || p_term || '%'
       OR coalesce(custom_fields::text, '') ILIKE '%' || p_term || '%'
       OR coalesce(professional_data::text, '') ILIKE '%' || p_term || '%'
     )
   ORDER BY full_name;
$$;

GRANT EXECUTE ON FUNCTION system_search_clients(TEXT) TO anon, authenticated, service_role;
