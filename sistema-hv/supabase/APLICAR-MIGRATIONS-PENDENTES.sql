-- ============================================================================
-- APLICAR MIGRATIONS PENDENTES (2026-06-22) — Sistema HV
-- ----------------------------------------------------------------------------
-- Consolida as 5 migrations que ainda NÃO foram aplicadas no banco e que estão
-- causando o erro 500 ao criar caso comercial (coluna aguardando_assinatura_at
-- inexistente), além de habilitar RG, campos customizados, busca por endereço e
-- a procuração (doc_kind).
--
-- COMO USAR:
--   1. Abra o Supabase Dashboard do projeto (sptfmfeoikukrhbekitl).
--   2. Menu lateral: SQL Editor → New query.
--   3. Cole TODO o conteúdo deste arquivo e clique em RUN.
--
-- É seguro reexecutar (tudo guardado por IF NOT EXISTS / DROP IF EXISTS).
-- Tudo roda numa transação: se algo falhar, NADA é aplicado (rollback).
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 0001 — RG em system_clients
-- ----------------------------------------------------------------------------
ALTER TABLE system_clients ADD COLUMN IF NOT EXISTS rg TEXT;

-- ----------------------------------------------------------------------------
-- 0002 — Campos customizados de cliente
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_client_field_defs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  key               TEXT NOT NULL,
  label             TEXT NOT NULL,
  field_type        TEXT NOT NULL
    CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'select', 'multiselect', 'boolean')),
  options           JSONB,
  required          BOOLEAN NOT NULL DEFAULT FALSE,
  help_text         TEXT,
  ordem             INTEGER NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS system_client_field_defs_key_org_active_unique
  ON system_client_field_defs (organization_id, key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_client_field_defs_org_active
  ON system_client_field_defs (organization_id, ordem)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_client_field_defs_updated_at ON system_client_field_defs;
CREATE TRIGGER trg_system_client_field_defs_updated_at
  BEFORE UPDATE ON system_client_field_defs
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_client_field_defs_active AS
  SELECT * FROM system_client_field_defs WHERE deleted_at IS NULL;

ALTER TABLE system_clients ADD COLUMN IF NOT EXISTS custom_fields JSONB;

CREATE INDEX IF NOT EXISTS idx_system_clients_custom_fields
  ON system_clients USING GIN (custom_fields);

DROP TRIGGER IF EXISTS trg_audit_client_field_defs ON system_client_field_defs;
CREATE TRIGGER trg_audit_client_field_defs
  AFTER INSERT OR UPDATE OR DELETE ON system_client_field_defs
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

ALTER TABLE system_client_field_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_client_field_defs_select_own_org ON system_client_field_defs;
CREATE POLICY system_client_field_defs_select_own_org ON system_client_field_defs
  FOR SELECT USING (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_client_field_defs_insert_own_org ON system_client_field_defs;
CREATE POLICY system_client_field_defs_insert_own_org ON system_client_field_defs
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_client_field_defs_update_own_org ON system_client_field_defs;
CREATE POLICY system_client_field_defs_update_own_org ON system_client_field_defs
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_client_field_defs_delete_own_org ON system_client_field_defs;
CREATE POLICY system_client_field_defs_delete_own_org ON system_client_field_defs
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_client_field_defs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_client_field_defs TO anon, authenticated;
GRANT SELECT ON system_client_field_defs_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 0003 — Caso em fase comercial / procuração  (CRÍTICA p/ o erro 500)
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS aguardando_assinatura_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_liberada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_liberada_by UUID;

CREATE INDEX IF NOT EXISTS idx_system_cases_aguardando_assinatura
  ON system_cases(aguardando_assinatura_at)
  WHERE aguardando_assinatura_at IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE system_case_documents
  ADD COLUMN IF NOT EXISTS doc_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_system_case_documents_doc_kind
  ON system_case_documents(doc_kind)
  WHERE doc_kind IS NOT NULL AND deleted_at IS NULL;

DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT c.*, cli.full_name AS client_name, cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 0004 — Busca de clientes cobre endereço/município, RG e telefone
--        (redefine system_search_clients — versão final)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 0005 — Purga de campo customizado
-- ----------------------------------------------------------------------------
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

COMMIT;

-- ============================================================================
-- Fim. Após rodar, recarregue o sistema e teste "Criar caso / gerar procuração".
-- ============================================================================
