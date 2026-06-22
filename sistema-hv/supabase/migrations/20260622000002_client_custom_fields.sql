-- ============================================================================
-- Sistema HV — Migration 0025 — Campos customizados de cliente (Melhoria 1)
-- ----------------------------------------------------------------------------
-- Permite ao admin definir campos ADICIONAIS de cadastro (texto, descrição,
-- número, data, escolha única, múltipla escolha, sim/não), usados apenas para
-- enriquecer o cadastro e PESQUISAR o cliente. Os campos fixos do cadastro NÃO
-- são afetados — esta tabela só ACRESCENTA atributos.
--   - system_client_field_defs: definições dos campos (o "form builder").
--   - system_clients.custom_fields (JSONB): valores por cliente { key: value }.
--   - system_search_clients(): busca que cobre nome, CPF, e-mail, campos
--                              profissionais E os campos customizados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Definições de campos customizados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_client_field_defs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  key               TEXT NOT NULL,          -- slug estável usado no JSONB custom_fields
  label             TEXT NOT NULL,          -- rótulo exibido no formulário
  field_type        TEXT NOT NULL
    CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'select', 'multiselect', 'boolean')),
  options           JSONB,                  -- array de strings (select/multiselect)
  required          BOOLEAN NOT NULL DEFAULT FALSE,
  help_text         TEXT,                   -- dica opcional sob o campo
  ordem             INTEGER NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE,

  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- key único por organização (entre os não-excluídos).
CREATE UNIQUE INDEX IF NOT EXISTS system_client_field_defs_key_org_active_unique
  ON system_client_field_defs (organization_id, key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_client_field_defs_org_active
  ON system_client_field_defs (organization_id, ordem)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_client_field_defs_updated_at
  BEFORE UPDATE ON system_client_field_defs
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_client_field_defs_active AS
  SELECT * FROM system_client_field_defs WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Valores por cliente — JSONB { key: value }
-- ----------------------------------------------------------------------------
ALTER TABLE system_clients
  ADD COLUMN IF NOT EXISTS custom_fields JSONB;

CREATE INDEX IF NOT EXISTS idx_system_clients_custom_fields
  ON system_clients USING GIN (custom_fields);

-- ----------------------------------------------------------------------------
-- 3) Busca de clientes (nome, CPF, e-mail, profissional E campos customizados)
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
       OR coalesce(email, '') ILIKE '%' || p_term || '%'
       OR coalesce(custom_fields::text, '') ILIKE '%' || p_term || '%'
       OR coalesce(professional_data::text, '') ILIKE '%' || p_term || '%'
     )
   ORDER BY full_name;
$$;

-- ----------------------------------------------------------------------------
-- 4) Auditoria + RLS + grants (padrão do sistema)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_client_field_defs ON system_client_field_defs;
CREATE TRIGGER trg_audit_client_field_defs
  AFTER INSERT OR UPDATE OR DELETE ON system_client_field_defs
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

ALTER TABLE system_client_field_defs ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_client_field_defs_select_own_org ON system_client_field_defs
  FOR SELECT USING (organization_id = system_current_organization_id());

CREATE POLICY system_client_field_defs_insert_own_org ON system_client_field_defs
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_client_field_defs_update_own_org ON system_client_field_defs
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_client_field_defs_delete_own_org ON system_client_field_defs
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_client_field_defs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_client_field_defs TO anon, authenticated;
GRANT SELECT ON system_client_field_defs_active TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION system_search_clients(TEXT) TO anon, authenticated, service_role;
