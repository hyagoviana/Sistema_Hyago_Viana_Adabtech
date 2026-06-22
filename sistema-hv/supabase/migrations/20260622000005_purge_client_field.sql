-- ============================================================================
-- Sistema HV — Migration 0028 — Purga de campo customizado (Melhoria 1, ajuste)
-- ----------------------------------------------------------------------------
-- Ao EXCLUIR uma definição de campo customizado, os valores daquela "coluna"
-- devem ser removidos do cadastro de TODOS os clientes (o operador JSONB `-`
-- não é acessível pelo supabase-js, daí a função). "Ocultar" um campo é outro
-- caminho (active=false) e NÃO apaga dados. (Ajuste pedido em 2026-06-22.)
-- ============================================================================

CREATE OR REPLACE FUNCTION system_fn_purge_client_field(p_org UUID, p_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE system_clients
     SET custom_fields = custom_fields - p_key
   WHERE organization_id = p_org
     AND custom_fields ? p_key;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_purge_client_field(UUID, TEXT) TO service_role, authenticated;
